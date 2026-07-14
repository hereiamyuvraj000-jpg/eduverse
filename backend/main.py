"""
EduVerse AI Lite - FastAPI backend.

Endpoints:
  GET  /api/health
  POST /api/teacher        -> AI Teacher explanation for a topic
  POST /api/quiz/generate  -> Generate a 10-question multiple choice quiz
  POST /api/quiz/submit    -> Score a submitted quiz attempt
  POST /api/planner        -> Generate a daily study timetable
"""

import os
import json
from datetime import date, datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from database import init_db, get_db
from ai_client import call_groq, extract_json, AIError

load_dotenv()
print("API Key loaded:", os.getenv("GROQ_API_KEY"))

app = FastAPI(title="EduVerse AI Lite API", version="1.0.0")
@app.get("/")
def home():
    return {"message": "EduVerse AI Backend is running"}
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://eduverse-one-lime.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class TopicRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)


class QuizGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    num_questions: int = Field(default=10, ge=1, le=20)


class QuizAnswer(BaseModel):
    question_index: int
    selected_option: str


class QuizSubmitRequest(BaseModel):
    topic: str
    questions: List[dict]
    answers: List[QuizAnswer]


class PlannerRequest(BaseModel):
    subjects: List[str] = Field(..., min_length=1)
    hours_per_day: float = Field(..., gt=0, le=24)
    exam_date: str  # ISO date string YYYY-MM-DD


# --------------------------------------------------------------------------
# Health check
# --------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "EduVerse AI Lite API"}


# --------------------------------------------------------------------------
# AI Teacher
# --------------------------------------------------------------------------

TEACHER_SYSTEM_PROMPT = """You are an expert, friendly teacher who explains any topic clearly \
to students. You ALWAYS respond with ONLY a single valid JSON object, no markdown fences, \
no commentary before or after. The JSON object must have exactly these keys:

{
  "easy_explanation": "a simple, beginner-friendly explanation of the topic (3-5 sentences)",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "examples": ["example 1", "example 2", "example 3"],
  "quiz_questions": [
    {"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "why"},
    ... exactly 5 questions total ...
  ],
  "summary": "a short 2-3 sentence summary of the whole topic"
}

Keep language clear and appropriate for a student audience. Do not include anything outside the JSON object."""


@app.post("/api/teacher")
async def ai_teacher(req: TopicRequest):
    user_prompt = f"Topic: {req.topic}\n\nGenerate the full JSON object as instructed."

    try:
        raw = await call_groq(TEACHER_SYSTEM_PROMPT, user_prompt, temperature=0.6)
        data = extract_json(raw)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    required_keys = {"easy_explanation", "key_points", "examples", "quiz_questions", "summary"}
    if not required_keys.issubset(data.keys()):
        raise HTTPException(status_code=502, detail="AI response missing required fields.")

    with get_db() as db:
        db.execute(
            "INSERT INTO teacher_history (topic, content) VALUES (?, ?)",
            (req.topic, json.dumps(data)),
        )

    return {"topic": req.topic, **data}


# --------------------------------------------------------------------------
# AI Quiz
# --------------------------------------------------------------------------

QUIZ_SYSTEM_PROMPT = """You are a quiz generator for students. You ALWAYS respond with ONLY a \
single valid JSON object, no markdown fences, no commentary. The JSON object must look like:

{
  "questions": [
    {
      "question": "...",
      "options": ["A text", "B text", "C text", "D text"],
      "correct_answer": "A text",
      "explanation": "short explanation of why this is correct"
    },
    ... exactly N questions ...
  ]
}

Each question must have exactly 4 distinct options, and "correct_answer" must exactly match \
one of the strings in "options". Vary difficulty from easy to moderately hard. Do not include \
anything outside the JSON object."""


@app.post("/api/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest):
    user_prompt = (
        f"Topic: {req.topic}\nNumber of questions: {req.num_questions}\n\n"
        "Generate the full JSON object as instructed."
    )

    try:
        raw = await call_groq(QUIZ_SYSTEM_PROMPT, user_prompt, temperature=0.7)
        data = extract_json(raw)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    questions = data.get("questions")
    if not questions or not isinstance(questions, list):
        raise HTTPException(status_code=502, detail="AI response missing 'questions' list.")

    with get_db() as db:
        db.execute(
            "INSERT INTO quiz_history (topic, questions) VALUES (?, ?)",
            (req.topic, json.dumps(questions)),
        )

    return {"topic": req.topic, "questions": questions}


@app.post("/api/quiz/submit")
def submit_quiz(req: QuizSubmitRequest):
    total = len(req.questions)
    if total == 0:
        raise HTTPException(status_code=400, detail="No questions provided.")

    answer_map = {a.question_index: a.selected_option for a in req.answers}

    results = []
    correct_count = 0
    for idx, q in enumerate(req.questions):
        selected = answer_map.get(idx)
        correct_answer = q.get("correct_answer")
        is_correct = selected is not None and selected == correct_answer
        if is_correct:
            correct_count += 1
        results.append(
            {
                "question_index": idx,
                "question": q.get("question"),
                "selected_option": selected,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            }
        )

    percentage = round((correct_count / total) * 100, 2)

    with get_db() as db:
        db.execute(
            "INSERT INTO quiz_attempts (topic, score, total, percentage) VALUES (?, ?, ?, ?)",
            (req.topic, correct_count, total, percentage),
        )

    return {
        "topic": req.topic,
        "score": correct_count,
        "total": total,
        "percentage": percentage,
        "results": results,
    }


# --------------------------------------------------------------------------
# Study Planner
# --------------------------------------------------------------------------

PLANNER_SYSTEM_PROMPT = """You are an expert academic study planner. You ALWAYS respond with \
ONLY a single valid JSON object, no markdown fences, no commentary. The JSON object must look like:

{
  "overview": "a short 2-3 sentence summary of the overall strategy",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_label": "Day 1",
      "sessions": [
        {"subject": "Math", "duration_hours": 1.5, "focus": "what to study/practice", "tip": "a short study tip"}
      ]
    },
    ... one entry per day from today until (and including) the exam date ...
  ]
}

Distribute the given subjects evenly and sensibly across the available days, respecting the \
total hours available per day. Prioritize weaker/harder-sounding subjects earlier and add \
lighter review sessions close to the exam date. Do not include anything outside the JSON object."""


@app.post("/api/planner")
async def study_planner(req: PlannerRequest):
    try:
        exam_dt = datetime.strptime(req.exam_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="exam_date must be in YYYY-MM-DD format.")

    today = date.today()
    if exam_dt < today:
        raise HTTPException(status_code=400, detail="exam_date must be today or in the future.")

    days_available = (exam_dt - today).days + 1
    subjects_str = ", ".join(req.subjects)

    user_prompt = (
        f"Today's date: {today.isoformat()}\n"
        f"Exam date: {req.exam_date}\n"
        f"Days available (inclusive): {days_available}\n"
        f"Subjects: {subjects_str}\n"
        f"Hours available per day: {req.hours_per_day}\n\n"
        "Generate the full JSON object as instructed, with one entry in 'days' for each "
        "calendar day from today through the exam date inclusive."
    )

    try:
        raw = await call_groq(PLANNER_SYSTEM_PROMPT, user_prompt, temperature=0.5)
        data = extract_json(raw)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if "days" not in data:
        raise HTTPException(status_code=502, detail="AI response missing 'days' field.")

    with get_db() as db:
        db.execute(
            "INSERT INTO study_plans (subjects, hours_per_day, exam_date, plan) VALUES (?, ?, ?, ?)",
            (subjects_str, req.hours_per_day, req.exam_date, json.dumps(data)),
        )

    return {
        "subjects": req.subjects,
        "hours_per_day": req.hours_per_day,
        "exam_date": req.exam_date,
        **data,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
