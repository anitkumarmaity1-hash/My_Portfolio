import json
import logging
import os
import re
import smtplib
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
GMAIL_USER = os.getenv("GMAIL_USER", "")
# 16-char Google App Password
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
# where alerts are delivered
NOTIFY_TO = os.getenv("NOTIFY_TO", GMAIL_USER)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")  # optional phone push
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
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


def send_email(record: dict) -> tuple[bool, str]:
    """Email the message to the portfolio owner. Reply-To is the visitor, so 'Reply' just works."""
    if not (GMAIL_USER and GMAIL_APP_PASSWORD and NOTIFY_TO):
        return False, "GMAIL_USER / GMAIL_APP_PASSWORD are not set on the server"
    msg = EmailMessage()
    subject = record["subject"] or "New message"
    msg["Subject"] = f"[Portfolio] {subject} — {record['name']}"
    msg["From"] = GMAIL_USER
    msg["To"] = NOTIFY_TO
    msg["Reply-To"] = f"{record['name']} <{record['email']}>"
    msg.set_content(
        f"Name:    {record['name']}\n"
        f"Email:   {record['email']}\n"
        f"Subject: {record['subject'] or '-'}\n"
        f"Time:    {record['timestamp']}\n\n"
        f"{record['message']}\n"
    )
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
            smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
        return True, ""
    except Exception as exc:
        logger.exception("Email notification failed")
        return False, f"{type(exc).__name__}: {exc}"


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


# Contact form submission: email + (optional) Telegram alert + local backup.
@app.post("/api/contact")
async def contact(payload: ContactMessage):
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "name": payload.name,
        "email": payload.email,
        "subject": payload.subject,
        "message": payload.message,
    }
    emailed, email_err = await run_in_threadpool(send_email, record)
    pushed = await run_in_threadpool(send_telegram, record)
    save_to_log(record)  # backup only; may be wiped by the host

    # Say "sent" only if the message actually reached you.
    if not (emailed or pushed):
        logger.error("CONTACT MESSAGE NOT DELIVERED: %s",
                     email_err or "no notifier configured")
        raise HTTPException(
            status_code=503,
            detail="Sorry, I couldn't deliver your message. Please email anitkumarmaity1@gmail.com directly.",
        )

    return {"success": True, "message": "Message received."}


# Diagnostics ---------------------------------------------------------------
# GET /api/notify-status              -> which notifiers are configured (no secrets)
# GET /api/notify-test?token=<ADMIN_TOKEN> -> sends a real test email and shows the exact error, if any
@app.get("/api/notify-status")
async def notify_status():
    return {
        "gmail_configured": bool(GMAIL_USER and GMAIL_APP_PASSWORD),
        "notify_to_set": bool(NOTIFY_TO),
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
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
    emailed, err = await run_in_threadpool(send_email, record)
    pushed = await run_in_threadpool(send_telegram, record)
    return {"email_sent": emailed, "email_error": err or None, "telegram_sent": pushed}
