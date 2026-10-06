import json
import logging
import os
import re
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("contact")

# Notification settings (set these as environment variables — never hard-code them)
# the Gmail address that sends the alert
GMAIL_USER = os.getenv("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(
    " ", "").strip()  # 16-char Google App Password
NOTIFY_TO = os.getenv("NOTIFY_TO", "").strip(
) or GMAIL_USER            # where alerts are delivered
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")  # optional phone push
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
# HTTPS email API (works on Render free)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = os.getenv("RESEND_FROM", "Portfolio <onboarding@resend.dev>")
# durable storage for every message
MONGO_URI = os.getenv("MONGO_URI", "").strip()
DB_NAME = os.getenv("DB_NAME", "portfolio").strip() or "portfolio"
# lets you run /api/notify-test
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

app = FastAPI()

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

DATA_DIR = Path("data")
CONTACT_LOG = DATA_DIR / "contact_messages.jsonl"

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ContactMessage(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=254)
    subject: str = Field("", max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)

    @field_validator("name", "email", "subject", "message")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v


# Home page
@app.get("/")
async def home():
    return FileResponse("templates/index.html")


def _email_body(record: dict) -> str:
    return (
        f"Name:    {record['name']}\n"
        f"Email:   {record['email']}\n"
        f"Subject: {record['subject'] or '-'}\n"
        f"Time:    {record['timestamp']}\n\n"
        f"{record['message']}\n"
    )


def _send_resend(record: dict) -> tuple[bool, str]:
    """HTTPS email API — not affected by Render's blocked SMTP ports."""
    payload = json.dumps({
        "from": RESEND_FROM,
        "to": [NOTIFY_TO],
        "reply_to": record["email"],
        "subject": f"[Portfolio] {record['subject'] or 'New message'} — {record['name']}",
        "text": _email_body(record),
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload, method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "portfolio-contact/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True, ""
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="ignore")[:300]
        logger.error("Resend failed: %s %s", exc.code, detail)
        return False, f"Resend HTTP {exc.code}: {detail}"
    except Exception as exc:
        logger.exception("Resend request failed")
        return False, f"{type(exc).__name__}: {exc}"


def send_email(record: dict) -> tuple[bool, str]:
    """Email the message to the portfolio owner (Reply-To = the visitor)."""
    if not NOTIFY_TO:
        return False, "NOTIFY_TO / GMAIL_USER is not set"
    if RESEND_API_KEY:
        return _send_resend(record)
    if not (GMAIL_USER and GMAIL_APP_PASSWORD):
        return False, "No email provider configured (set RESEND_API_KEY, or GMAIL_USER + GMAIL_APP_PASSWORD)"
    # Gmail SMTP: works locally / on paid hosts. Render FREE blocks ports 465/587.
    msg = EmailMessage()
    msg["Subject"] = f"[Portfolio] {record['subject'] or 'New message'} — {record['name']}"
    msg["From"] = GMAIL_USER
    msg["To"] = NOTIFY_TO
    msg["Reply-To"] = f"{record['name']} <{record['email']}>"
    msg.set_content(_email_body(record))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as smtp:
            smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
        return True, ""
    except Exception as exc:
        logger.exception("Gmail SMTP failed")
        return False, f"{type(exc).__name__}: {exc}"


_mongo_client = None


def save_to_mongo(record: dict) -> tuple[bool, str]:
    """Durable storage in MongoDB Atlas (collection: contact_messages)."""
    global _mongo_client
    if not MONGO_URI:
        return False, "MONGO_URI is not set"
    try:
        from pymongo import MongoClient
        if _mongo_client is None:
            _mongo_client = MongoClient(
                MONGO_URI, serverSelectionTimeoutMS=6000)
        _mongo_client[DB_NAME]["contact_messages"].insert_one(dict(record))
        return True, ""
    except Exception as exc:
        logger.exception("MongoDB save failed")
        return False, f"{type(exc).__name__}: {exc}"[:300]


def send_telegram(record: dict) -> bool:
    """Optional instant push to your phone through a Telegram bot."""
    if not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
        return False
    text = (
        f"New portfolio message\n"
        f"From: {record['name']} <{record['email']}>\n"
        f"Subject: {record['subject'] or '-'}\n\n{record['message']}"
    )[:4000]
    data = urllib.parse.urlencode(
        {"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=10):
            return True
    except Exception:
        logger.exception("Telegram notification failed")
        return False


def save_to_log(record: dict) -> bool:
    """Local backup only — free hosts such as Render wipe this file on redeploy."""
    try:
        DATA_DIR.mkdir(exist_ok=True)
        with CONTACT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return True
    except OSError:
        return False


# Contact form submission: email + optional Telegram + MongoDB + local backup.
@app.post("/api/contact")
async def contact(payload: ContactMessage):
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "name": payload.name,
        "email": payload.email,
        "subject": payload.subject,
        "message": payload.message,
    }
    (emailed, email_err) = await run_in_threadpool(send_email, record)
    pushed = await run_in_threadpool(send_telegram, record)
    (stored, mongo_err) = await run_in_threadpool(save_to_mongo, record)
    save_to_log(record)  # last-resort backup; may be wiped by the host

    if not (emailed or pushed):
        logger.error("NO ALERT SENT (mongo_saved=%s): email=%s",
                     stored, email_err)
    # The visitor sees success only if the message reached you or is safely stored.
    if not (emailed or pushed or stored):
        logger.error(
            "CONTACT MESSAGE NOT DELIVERED: email=%s mongo=%s", email_err, mongo_err)
        raise HTTPException(
            status_code=503,
            detail="Sorry, I couldn't deliver your message. Please email anitkumarmaity1@gmail.com directly.",
        )
    return {"success": True, "message": "Message received."}


# Diagnostics ---------------------------------------------------------------
# GET /api/notify-status                    -> what is configured (no secrets)
# GET /api/notify-test?token=<ADMIN_TOKEN>  -> runs a real test of email, Telegram and MongoDB
@app.get("/api/notify-status")
async def notify_status():
    return {
        "resend_configured": bool(RESEND_API_KEY),
        "gmail_smtp_configured": bool(GMAIL_USER and GMAIL_APP_PASSWORD),
        "notify_to_set": bool(NOTIFY_TO),
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "mongo_configured": bool(MONGO_URI),
        "test_endpoint_enabled": bool(ADMIN_TOKEN),
    }


@app.get("/api/notify-test")
async def notify_test(token: str = ""):
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "name": "Test", "email": NOTIFY_TO or "test@example.com",
        "subject": "Notification test", "message": "If you can read this, contact alerts work.",
    }
    emailed, email_err = await run_in_threadpool(send_email, record)
    pushed = await run_in_threadpool(send_telegram, record)
    stored, mongo_err = await run_in_threadpool(save_to_mongo, record)
    return {
        "email_sent": emailed, "email_error": email_err or None,
        "telegram_sent": pushed,
        "mongo_saved": stored, "mongo_error": mongo_err or None,
    }
