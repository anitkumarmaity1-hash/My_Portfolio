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
GMAIL_USER = os.getenv("GMAIL_USER", "")                 # the Gmail address that sends the alert
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")  # 16-char Google App Password
NOTIFY_TO = os.getenv("NOTIFY_TO", GMAIL_USER)            # where alerts are delivered
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")  # optional phone push
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

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


def send_email(record: dict) -> bool:
    """Email the message to the portfolio owner. Reply-To is the visitor, so 'Reply' just works."""
    if not (GMAIL_USER and GMAIL_APP_PASSWORD and NOTIFY_TO):
        return False
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
        return True
    except Exception:
        logger.exception("Email notification failed")
        return False


def send_telegram(record: dict) -> bool:
    """Optional instant push to your phone through a Telegram bot."""
    if not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
        return False
    text = (
        f"New portfolio message\n"
        f"From: {record['name']} <{record['email']}>\n"
        f"Subject: {record['subject'] or '-'}\n\n{record['message']}"
    )[:4000]
    data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
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
    emailed = await run_in_threadpool(send_email, record)
    pushed = await run_in_threadpool(send_telegram, record)
    saved = save_to_log(record)

    # Only tell the visitor "sent" if the message reached you somewhere.
    if not (emailed or pushed):
        logger.warning("Contact message not delivered by email/Telegram (saved to log: %s)", saved)
        if not saved:
            raise HTTPException(status_code=500, detail="Could not send your message. Please email directly.")

    return {"success": True, "message": "Message received."}