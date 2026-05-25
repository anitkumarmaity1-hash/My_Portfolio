from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Home page


@app.get("/")
async def home():
    return FileResponse("templates/index.html")
