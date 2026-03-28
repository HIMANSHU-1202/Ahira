from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

from ai.brain import get_response
from ai.database import init_db
from ai.reminders import get_reminders, add_reminder, delete_reminder, toggle_reminder

app = FastAPI()

templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


# ─────────────────────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[HistoryMessage] = []


class Reminder(BaseModel):
    task: str
    date: Optional[str] = None
    time: Optional[str] = None
    priority: str = "normal"


# ─────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()


# ─────────────────────────────────────────────────────────────
# PAGES
# ─────────────────────────────────────────────────────────────

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# ─────────────────────────────────────────────────────────────
# CHAT  — accepts full history so Claude has context
# ─────────────────────────────────────────────────────────────

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        # Convert pydantic models to plain dicts for brain.py
        history = [{"role": m.role, "content": m.content} for m in req.history]
        result  = get_response(req.message, history)
        return {
            "reply":    result["reply"],
            "reminder": result.get("reminder")
        }
    except Exception as e:
        print(f"[Chat Error] {e}")
        return {
            "reply": "I'm having a moment! Give me a second and try again 💜",
            "reminder": None
        }


# ─────────────────────────────────────────────────────────────
# REMINDERS
# ─────────────────────────────────────────────────────────────

@app.get("/reminders")
def list_reminders():
    return {"tasks": get_reminders()}


@app.post("/add_reminder")
def create_reminder(reminder: Reminder):
    if not reminder.task or not reminder.task.strip():
        return {"status": "error", "message": "Task cannot be empty"}
    add_reminder(reminder.task, reminder.date, reminder.time, reminder.priority)
    return {"status": "success"}


@app.delete("/reminder/{reminder_id}")
def delete_task(reminder_id: int):
    delete_reminder(reminder_id)
    return {"status": "deleted"}


@app.post("/reminder/{reminder_id}/toggle")
def toggle_task(reminder_id: int):
    toggle_reminder(reminder_id)
    return {"status": "updated"}


# ─────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}