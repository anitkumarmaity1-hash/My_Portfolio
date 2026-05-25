from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Anit Kumar Maity — Portfolio API")

# ── MongoDB Connection ──
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client["portfolio_db"]
contacts_col = db["contacts"]

# ── Pydantic Model ──


class ContactMessage(BaseModel):
    name: str
    email: str
    subject: str
    message: str

# ── API Routes ──


@app.post("/api/contact")
async def submit_contact(data: ContactMessage):
    """Save a contact form submission to MongoDB."""
    try:
        doc = data.model_dump()
        doc["submitted_at"] = datetime.utcnow().isoformat()
        result = await contacts_col.insert_one(doc)
        return JSONResponse(
            status_code=200,
            content={"success": True,
                     "message": "Message received! I'll get back to you soon."}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Anit Kumar Maity Portfolio"}

# ── Serve Static Frontend ──
# Mount static assets (css, js)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Catch-all → serve index.html (SPA-style)


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    return FileResponse("templates/index.html")
