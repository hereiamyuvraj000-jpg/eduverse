import os
import json
import asyncio
import logging
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from database import get_db, init_db
from ai_client import call_groq, extract_json, AIError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eduverse")

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(title="EduVerse AI", version="2.0.0")

_allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
if _allowed_origins_env.strip() == "*":
    _origins = ["*"]
else:
    _origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def run_ai_call(system_prompt: str, user_prompt: str) -> str:
    """
    Calls call_groq regardless of whether it is implemented as a sync or
    async function, and normalizes any failure into AIError.
    """
    try:
        if asyncio.iscoroutinefunction(call_groq):
            return await call_groq(system_prompt, user_prompt)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, call_groq, system_prompt, user_prompt)
    except AIError:
        raise
    except Exception as e:
        raise AIError(str(e))


async def get_ai_json(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    try:
        raw_response = await run_ai_call(system_prompt, user_prompt)
        data = extract_json(raw_response)
    except AIError:
        raise
    except Exception as e:
        raise AIError(f"Failed to parse AI response: {str(e)}")

    if not isinstance(data, dict):
        raise AIError("AI response was not a valid JSON object.")
    return data


# ============================================================
# CONSTANTS
# ============================================================

STUDENT_LEVELS = [
    "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
    "CBSE", "ICSE", "JEE Main", "JEE Advanced", "NEET", "College", "Professional",
]

EXPLANATION_LENGTHS = ["Short", "Medium", "Detailed", "Comprehensive"]

QUESTION_TYPES = [
    "MCQ", "True False", "Assertion Reason", "Fill in blanks",
    "One Word", "Case Study", "Numericals",
]

DIFFICULTIES = ["Easy", "Moderate", "Hard", "Mixed"]

DIFFICULTY_TIME_MAP = {"Easy": 30, "Moderate": 60, "Hard": 120}

MAX_QUESTIONS = 500
BATCH_SIZE = 20

LEVEL_GUIDANCE: Dict[str, str] = {
    "Class 6": "Explain in very simple, easy-to-understand language using everyday examples suitable for an 11-12 year old. Avoid technical jargon and complex formulas.",
    "Class 7": "Explain in simple language with basic examples suitable for a 12-13 year old, introducing foundational terminology gently.",
    "Class 8": "Explain clearly with foundational concepts and simple examples suitable for a 13-14 year old, introducing basic terminology and simple diagrams.",
    "Class 9": "Explain with clear foundational concepts, basic formulas where relevant, and examples suitable for a 14-15 year old.",
    "Class 10": "Explain board-exam-oriented content with clear definitions, formulas, and diagrams suitable for a 15-16 year old preparing for board exams.",
    "Class 11": "Explain with increased depth, introducing intermediate formulas, derivations and concepts suitable for a student beginning senior secondary studies.",
    "Class 12": "Explain with board and competitive-exam-oriented depth, including formulas, derivations and applications suitable for a senior secondary student.",
    "CBSE": "Explain strictly aligned with CBSE curriculum style, using NCERT-style definitions, stepwise formulas and board-exam-oriented explanations.",
    "ICSE": "Explain aligned with ICSE curriculum style, with detailed conceptual clarity and structured explanations as expected in ICSE examinations.",
    "JEE Main": "Explain with JEE Main level depth, including important formulas, shortcut techniques, and problem-solving approaches for competitive exam preparation.",
    "JEE Advanced": "Explain deeply with rigorous derivations, advanced mathematics, multi-concept problem-solving, and tricky edge cases expected at JEE Advanced level.",
    "NEET": "Explain with a focus on biology and medical entrance exam style, emphasizing NCERT-based facts, diagrams, and application to human physiology or related medical concepts where relevant.",
    "College": "Explain with undergraduate-level academic depth, including theoretical foundations, derivations, and connections to related advanced topics.",
    "Professional": "Explain using precise technical and professional language suitable for a practicing professional or researcher, focusing on real-world application and industry-relevant depth.",
}

LENGTH_GUIDANCE: Dict[str, str] = {
    "Short": "Keep each explanation concise and to the point, roughly 80-150 words.",
    "Medium": "Provide a moderately detailed explanation, roughly 200-350 words.",
    "Detailed": "Provide a thorough, well-structured explanation, roughly 400-700 words.",
    "Comprehensive": "Provide an extensive, exhaustive explanation covering all nuances, roughly 800-1200 words.",
}

TEACHER_FIELDS: Dict[str, str] = {
    "beginner_explanation": "string - simple explanation suitable for a beginner",
    "intermediate_explanation": "string - explanation suitable for an intermediate learner",
    "advanced_explanation": "string - in-depth explanation for an advanced learner",
    "jee_main_notes": "string - notes focused on JEE Main exam relevance (empty string if not applicable)",
    "jee_advanced_notes": "string - notes focused on JEE Advanced exam relevance with derivations (empty string if not applicable)",
    "neet_notes": "string - notes focused on NEET / medical-biology relevance (empty string if not applicable)",
    "college_notes": "string - notes suitable for college level understanding",
    "professional_notes": "string - notes using professional/technical language",
    "history": "string - historical background of the topic",
    "applications": "array of strings - real world applications",
    "real_life_examples": "array of strings - real life examples",
    "advantages": "array of strings",
    "disadvantages": "array of strings",
    "important_terms": "array of objects with keys 'term' and 'definition'",
    "key_points": "array of strings",
    "important_formulas": "array of objects with keys 'formula' and 'description'",
    "derivations": "array of strings - full derivations where applicable",
    "step_by_step_derivations": "array of objects with keys 'title' and 'steps' (array of strings)",
    "common_mistakes": "array of strings",
    "memory_tricks": "array of strings",
    "mnemonics": "array of strings",
    "study_tips": "array of strings",
    "exam_tips": "array of strings",
    "revision_notes": "array of strings",
    "summary": "string - concise overall summary",
    "flashcards": "array of objects with keys 'front' and 'back'",
    "practice_questions": "array of objects with keys 'question' and 'answer'",
    "viva_questions": "array of strings",
    "interview_questions": "array of strings",
    "assertion_reason_questions": "array of objects with keys 'assertion', 'reason', 'answer'",
    "true_false_questions": "array of objects with keys 'statement', 'answer'",
    "fill_in_the_blanks": "array of objects with keys 'question', 'answer'",
    "mcqs": "array of objects with keys 'question', 'options' (array of 4 strings), 'answer'",
    "numericals": "array of objects with keys 'question', 'solution', 'answer'",
    "case_studies": "array of objects with keys 'scenario', 'questions' (array of strings)",
    "previous_year_patterns": "array of strings",
    "ascii_diagram": "string - a simple ASCII art diagram representing the concept, empty string if not applicable",
    "mermaid_diagram": "string - valid mermaid.js diagram syntax representing the concept, empty string if not applicable",
    "mind_map": "string - valid mermaid.js mindmap syntax, empty string if not applicable",
    "flowchart": "string - valid mermaid.js flowchart syntax, empty string if not applicable",
}

TYPE_INSTRUCTIONS: Dict[str, str] = {
    "MCQ": "Each question must include exactly 4 options in the 'options' array, and 'correct_answer' must exactly match one of those options.",
    "True False": "Each 'question' is a factual statement to be judged true or false. Set 'options' to a two-item array [\"True\", \"False\"] and 'correct_answer' to either \"True\" or \"False\".",
    "Assertion Reason": (
        "Each 'question' must clearly state an Assertion (A) and a Reason (R). "
        "Set 'options' to these four standard choices: "
        "(A) Both Assertion and Reason are true, and Reason is the correct explanation of Assertion; "
        "(B) Both Assertion and Reason are true, but Reason is NOT the correct explanation of Assertion; "
        "(C) Assertion is true but Reason is false; "
        "(D) Assertion is false but Reason is true. "
        "'correct_answer' must exactly match one of these four option strings."
    ),
    "Fill in blanks": "Each 'question' must be a sentence containing a blank shown as \"_____\" and 'correct_answer' must be the exact word or phrase that completes it. Set 'options' to an empty array.",
    "One Word": "Each 'question' must be answerable in a single word or short phrase, and 'correct_answer' must be that word or phrase. Set 'options' to an empty array.",
    "Case Study": "Each 'question' must begin with a short real-world scenario (2-4 sentences) followed by a specific question about it, and 'correct_answer' must directly answer that question. Set 'options' to an empty array unless naturally multiple choice, in which case include 4 options.",
    "Numericals": "Each 'question' must be a numerical problem to solve. 'correct_answer' must be the final numeric answer (include units if relevant), and 'explanation' must show the complete step-by-step solution. Set 'options' to an empty array.",
}


def default_value_for_field(spec: str) -> Any:
    if spec.startswith("array"):
        return []
    return ""


def normalize_teacher_response(data: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    for field, spec in TEACHER_FIELDS.items():
        normalized[field] = data.get(field, default_value_for_field(spec))
    return normalized


# ============================================================
# REQUEST MODELS
# ============================================================

class TeacherRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    student_level: str
    explanation_length: str

    @field_validator("student_level")
    @classmethod
    def validate_student_level(cls, v: str) -> str:
        if v not in STUDENT_LEVELS:
            raise ValueError(f"Invalid student_level. Must be one of {STUDENT_LEVELS}")
        return v

    @field_validator("explanation_length")
    @classmethod
    def validate_explanation_length(cls, v: str) -> str:
        if v not in EXPLANATION_LENGTHS:
            raise ValueError(f"Invalid explanation_length. Must be one of {EXPLANATION_LENGTHS}")
        return v


class QuizGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    difficulty: str
    question_count: int = Field(..., ge=1, le=MAX_QUESTIONS)
    question_type: str

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        if v not in DIFFICULTIES:
            raise ValueError(f"Invalid difficulty. Must be one of {DIFFICULTIES}")
        return v

    @field_validator("question_type")
    @classmethod
    def validate_question_type(cls, v: str) -> str:
        if v not in QUESTION_TYPES:
            raise ValueError(f"Invalid question_type. Must be one of {QUESTION_TYPES}")
        return v


class QuizAnswer(BaseModel):
    question_id: Union[int, str]
    selected_answer: Optional[str] = None


class QuizSubmitRequest(BaseModel):
    quiz_id: int
    answers: List[QuizAnswer]


class PlannerRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    goal: Optional[str] = None
    student_level: Optional[str] = None
    duration_days: Optional[int] = None
    hours_per_day: Optional[float] = None

    model_config = {"extra": "allow"}


# ============================================================
# DATABASE HELPERS
# ============================================================

def save_teacher_history(db: sqlite3.Connection, topic: str, student_level: str,
                          explanation_length: str, result: Dict[str, Any]) -> int:
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO teacher_history (topic, student_level, explanation_length, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (topic, student_level, explanation_length, json.dumps(result), now_iso()),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        logger.error(f"Failed to save teacher_history: {e}")
        return -1


def save_quiz_history(db: sqlite3.Connection, quiz_record: Dict[str, Any]) -> int:
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO quiz_history (topic, difficulty, question_type, question_count, questions, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                quiz_record["topic"],
                quiz_record["difficulty"],
                quiz_record["question_type"],
                quiz_record["question_count"],
                json.dumps(quiz_record["questions"]),
                now_iso(),
            ),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        logger.error(f"Failed to save quiz_history: {e}")
        return -1


def save_quiz_attempt(db: sqlite3.Connection, quiz_id: int, results: List[Dict[str, Any]],
                       correct_count: int, total_questions: int, score_percent: float) -> int:
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO quiz_attempts (quiz_id, results, correct_count, total_questions, score_percent, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (quiz_id, json.dumps(results), correct_count, total_questions, score_percent, now_iso()),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        logger.error(f"Failed to save quiz_attempts: {e}")
        return -1


def save_study_plan(db: sqlite3.Connection, subject: str, details: Dict[str, Any],
                     plan: Dict[str, Any]) -> int:
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO study_plans (subject, details, plan, created_at) VALUES (?, ?, ?, ?)",
            (subject, json.dumps(details), json.dumps(plan), now_iso()),
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        logger.error(f"Failed to save study_plans: {e}")
        return -1


# ============================================================
# PROMPT BUILDERS
# ============================================================

def build_teacher_system_prompt() -> str:
    return (
        "You are EduVerse AI, an expert educational content generator. "
        "You must always respond with a single valid JSON object and nothing else. "
        "Never wrap the JSON in markdown code fences. Never include explanations outside the JSON. "
        "Never leave any field empty without reason; every field must contain rich, accurate, "
        "well-structured educational content appropriate to the requested student level."
    )


def build_teacher_user_prompt(topic: str, student_level: str, explanation_length: str) -> str:
    level_instruction = LEVEL_GUIDANCE.get(student_level, "Explain at an appropriate academic level.")
    length_instruction = LENGTH_GUIDANCE.get(explanation_length, "Provide a well-balanced explanation.")
    field_lines = "\n".join(f'- "{name}": {desc}' for name, desc in TEACHER_FIELDS.items())

    return f"""Generate premium educational content for the following request.

Topic: {topic}
Student Level: {student_level}
Explanation Length: {explanation_length}

Level Instruction: {level_instruction}
Length Instruction: {length_instruction}

If a field is not naturally applicable to this topic or student level (for example jee_advanced_notes
for a Class 6 topic, or neet_notes for a non-biology topic), still return the key with an appropriate
short value, or an empty string / empty array, rather than omitting it.

Return ONLY a single valid JSON object with EXACTLY these keys and value types, no extra keys, no
markdown formatting, and no text outside the JSON:

{field_lines}

The JSON must be syntactically valid and fully parseable. Do not wrap it in markdown code fences.
"""


def build_quiz_system_prompt() -> str:
    return (
        "You are EduVerse AI, an expert quiz generator. You must always respond with a single valid "
        "JSON object and nothing else, with no markdown code fences and no text outside the JSON."
    )


def build_quiz_batch_prompt(topic: str, difficulty: str, question_type: str,
                             batch_count: int, start_index: int, mixed: bool) -> str:
    if mixed:
        difficulty_instruction = (
            "Generate a well-balanced mix of Easy, Moderate and Hard questions across this batch. "
            "For every question, set the 'difficulty' field to exactly one of \"Easy\", \"Moderate\" "
            "or \"Hard\" based on its actual difficulty."
        )
    else:
        difficulty_instruction = (
            f"Every question in this batch must be {difficulty} difficulty. "
            f"Set the 'difficulty' field for every question to exactly \"{difficulty}\"."
        )

    type_instruction = TYPE_INSTRUCTIONS.get(question_type, "")

    return f"""Generate exactly {batch_count} original {question_type} questions on the topic: {topic}.

{difficulty_instruction}

{type_instruction}

Number the questions sequentially starting at {start_index} (ids {start_index} to {start_index + batch_count - 1}).

Return ONLY a single valid JSON object with exactly one key "questions", which is an array of exactly
{batch_count} question objects. Each question object must contain exactly these keys:
- "id": integer id as specified above
- "type": "{question_type}"
- "difficulty": "Easy", "Moderate" or "Hard"
- "question": string
- "options": array of strings (as specified above; empty array if not applicable)
- "correct_answer": string
- "explanation": string, a brief explanation of why the correct answer is correct

Do not include any text outside the JSON object. Do not wrap the JSON in markdown code fences.
Ensure the questions are original, accurate, and appropriate for the given difficulty, and avoid
repeating well-worn textbook examples.
"""


def build_planner_system_prompt() -> str:
    return (
        "You are EduVerse AI, an expert academic study planner. You must always respond with a single "
        "valid JSON object and nothing else, with no markdown code fences and no text outside the JSON."
    )


def build_planner_user_prompt(details: Dict[str, Any]) -> str:
    return f"""Create a detailed, day-by-day study plan based on the following request details:

{json.dumps(details, indent=2)}

Return ONLY a valid JSON object with these keys:
- "overview": string summary of the plan
- "daily_plan": array of objects, each with "day" (integer), "focus_area" (string),
  "tasks" (array of strings), "duration_hours" (number)
- "milestones": array of strings
- "tips": array of strings

Do not include any text outside the JSON object. Do not wrap it in markdown code fences.
"""


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "EduVerse AI", "timestamp": now_iso()}


@app.post("/api/teacher")
async def ai_teacher(payload: TeacherRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        system_prompt = build_teacher_system_prompt()
        user_prompt = build_teacher_user_prompt(payload.topic, payload.student_level, payload.explanation_length)
        data = await get_ai_json(system_prompt, user_prompt)
        result = normalize_teacher_response(data)

        result["topic"] = payload.topic
        result["student_level"] = payload.student_level
        result["explanation_length"] = payload.explanation_length

        teacher_id = save_teacher_history(db, payload.topic, payload.student_level,
                                           payload.explanation_length, result)
        result["teacher_id"] = teacher_id
        return result
    except AIError as e:
        logger.error(f"AI error in /api/teacher: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in /api/teacher")
        raise HTTPException(status_code=500, detail="Failed to generate teacher content.")


@app.post("/api/quiz/generate")
async def generate_quiz(payload: QuizGenerateRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        total = payload.question_count
        mixed = payload.difficulty == "Mixed"
        system_prompt = build_quiz_system_prompt()

        all_questions: List[Dict[str, Any]] = []
        start_index = 1
        remaining = total

        while remaining > 0:
            batch_count = min(BATCH_SIZE, remaining)
            user_prompt = build_quiz_batch_prompt(
                payload.topic, payload.difficulty, payload.question_type,
                batch_count, start_index, mixed,
            )

            try:
                batch_data = await get_ai_json(system_prompt, user_prompt)
            except AIError as e:
                logger.error(f"Batch generation failed at index {start_index}: {e}")
                raise HTTPException(
                    status_code=502,
                    detail=f"AI service error while generating questions: {str(e)}",
                )

            batch_questions = batch_data.get("questions", [])
            if not isinstance(batch_questions, list):
                raise HTTPException(
                    status_code=502,
                    detail="AI response did not contain a valid 'questions' array.",
                )

            batch_questions = batch_questions[:batch_count]
            if len(batch_questions) < batch_count:
                logger.warning(
                    f"Requested {batch_count} questions but received {len(batch_questions)} "
                    f"starting at index {start_index}."
                )

            for q in batch_questions:
                if not isinstance(q, dict):
                    continue
                q_difficulty = q.get("difficulty") if mixed else payload.difficulty
                if q_difficulty not in DIFFICULTY_TIME_MAP:
                    q_difficulty = "Moderate"
                q["difficulty"] = q_difficulty
                q["recommended_time_seconds"] = DIFFICULTY_TIME_MAP[q_difficulty]
                q["id"] = q.get("id", start_index)
                q.setdefault("type", payload.question_type)
                q.setdefault("options", [])
                all_questions.append(q)
                start_index += 1

            remaining -= batch_count
            await asyncio.sleep(0.15)

        quiz_record = {
            "topic": payload.topic,
            "difficulty": payload.difficulty,
            "question_type": payload.question_type,
            "question_count": len(all_questions),
            "questions": all_questions,
        }
        quiz_id = save_quiz_history(db, quiz_record)
        quiz_record["quiz_id"] = quiz_id
        return quiz_record
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in /api/quiz/generate")
        raise HTTPException(status_code=500, detail="Failed to generate quiz.")


@app.post("/api/quiz/submit")
async def submit_quiz(payload: QuizSubmitRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute("SELECT questions FROM quiz_history WHERE id = ?", (payload.quiz_id,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Quiz not found.")

        try:
            questions = json.loads(row[0])
        except Exception:
            raise HTTPException(status_code=500, detail="Stored quiz data is corrupted.")

        questions_by_id = {str(q.get("id")): q for q in questions if isinstance(q, dict)}

        results: List[Dict[str, Any]] = []
        correct_count = 0

        for ans in payload.answers:
            qid = str(ans.question_id)
            question = questions_by_id.get(qid)
            if question is None:
                results.append({
                    "question_id": ans.question_id,
                    "is_correct": False,
                    "correct_answer": None,
                    "selected_answer": ans.selected_answer,
                    "explanation": "",
                })
                continue

            correct_answer = question.get("correct_answer")
            is_correct = (
                ans.selected_answer is not None
                and correct_answer is not None
                and str(ans.selected_answer).strip().lower() == str(correct_answer).strip().lower()
            )
            if is_correct:
                correct_count += 1

            results.append({
                "question_id": ans.question_id,
                "is_correct": is_correct,
                "correct_answer": correct_answer,
                "selected_answer": ans.selected_answer,
                "explanation": question.get("explanation", ""),
            })

        total_questions = len(payload.answers)
        score_percent = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0.0

        attempt_id = save_quiz_attempt(db, payload.quiz_id, results, correct_count, total_questions, score_percent)

        return {
            "attempt_id": attempt_id,
            "quiz_id": payload.quiz_id,
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "score_percent": score_percent,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in /api/quiz/submit")
        raise HTTPException(status_code=500, detail="Failed to submit quiz.")


@app.post("/api/planner")
async def study_planner(payload: PlannerRequest, db: sqlite3.Connection = Depends(get_db)):
    try:
        details = payload.model_dump()
        system_prompt = build_planner_system_prompt()
        user_prompt = build_planner_user_prompt(details)

        plan = await get_ai_json(system_prompt, user_prompt)

        plan_id = save_study_plan(db, payload.subject, details, plan)
        plan["plan_id"] = plan_id
        plan["subject"] = payload.subject
        return plan
    except AIError as e:
        logger.error(f"AI error in /api/planner: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in /api/planner")
        raise HTTPException(status_code=500, detail="Failed to generate study plan.")