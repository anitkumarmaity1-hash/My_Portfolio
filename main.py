import json
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

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


# Contact form submission.
# Stored locally as a JSON line per message (no external service required).
# Anit can later wire this up to email/DB delivery if needed.
@app.post("/api/contact")
async def contact(payload: ContactMessage):
    DATA_DIR.mkdir(exist_ok=True)
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "name": payload.name,
        "email": payload.email,
        "subject": payload.subject,
        "message": payload.message,
    }
    try:
        with CONTACT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save your message. Please email directly.") from exc

    return {"success": True, "message": "Message received."}
