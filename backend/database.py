"""
database.py - SQLite persistence layer for EduVerse AI Pro.

Provides init_db() to create all required tables, plus typed helper
functions for saving and retrieving teacher content, quizzes, quiz
attempts, study plans, student profiles, and learning progress.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

DB_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "eduverse.db"),
)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Context manager yielding a SQLite connection with row access by name.

    Commits on success, rolls back on any exception, and always closes
    the connection.
    """
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables and indexes required by the application.

    Safe to call on every startup — uses CREATE TABLE IF NOT EXISTS.
    """
    with get_connection() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS teacher_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                topic TEXT NOT NULL,
                student_level TEXT NOT NULL,
                explanation_length TEXT NOT NULL,
                content_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS quiz_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                topic TEXT NOT NULL,
                student_level TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                question_type TEXT NOT NULL,
                num_questions INTEGER NOT NULL,
                questions_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id INTEGER NOT NULL,
                student_id TEXT,
                answers_json TEXT NOT NULL,
                score REAL NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                incorrect_count INTEGER NOT NULL,
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (quiz_id) REFERENCES quiz_history(id)
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS study_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                goal TEXT NOT NULL,
                student_level TEXT NOT NULL,
                duration_days INTEGER NOT NULL,
                hours_per_day REAL,
                plan_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS student_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT UNIQUE NOT NULL,
                name TEXT,
                student_level TEXT,
                preferences_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                mastery_score REAL DEFAULT 0,
                attempts_count INTEGER DEFAULT 0,
                last_activity TEXT NOT NULL,
                notes TEXT
            )
            """
        )

        cur.execute("CREATE INDEX IF NOT EXISTS idx_teacher_student ON teacher_history(student_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_quiz_student ON quiz_history(student_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_plans_student ON study_plans(student_id)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_progress_student_topic ON learning_progress(student_id, topic)"
        )


# --------------------------------------------------------------------------
# Serialization helpers
# --------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def _loads(data: Optional[str]) -> Any:
    if not data:
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        return None


# --------------------------------------------------------------------------
# Teacher history
# --------------------------------------------------------------------------

def save_teacher_record(
    topic: str,
    student_level: str,
    explanation_length: str,
    content: dict,
    student_id: Optional[str] = None,
) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO teacher_history
               (student_id, topic, student_level, explanation_length, content_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (student_id, topic, student_level, explanation_length, _dumps(content), _now()),
        )
        return int(cur.lastrowid)


def get_teacher_history(student_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        if student_id:
            rows = conn.execute(
                "SELECT * FROM teacher_history WHERE student_id = ? ORDER BY id DESC LIMIT ?",
                (student_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM teacher_history ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        results = []
        for r in rows:
            row = dict(r)
            row["content"] = _loads(row.pop("content_json"))
            results.append(row)
        return results


def get_teacher_record(record_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM teacher_history WHERE id = ?", (record_id,)).fetchone()
        if not row:
            return None
        result = dict(row)
        result["content"] = _loads(result.pop("content_json"))
        return result


# --------------------------------------------------------------------------
# Quiz history / attempts
# --------------------------------------------------------------------------

def save_quiz(
    topic: str,
    student_level: str,
    difficulty: str,
    question_type: str,
    num_questions: int,
    questions: list,
    student_id: Optional[str] = None,
) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO quiz_history
               (student_id, topic, student_level, difficulty, question_type,
                num_questions, questions_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                student_id,
                topic,
                student_level,
                difficulty,
                question_type,
                num_questions,
                _dumps(questions),
                _now(),
            ),
        )
        return int(cur.lastrowid)


def get_quiz(quiz_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM quiz_history WHERE id = ?", (quiz_id,)).fetchone()
        if not row:
            return None
        result = dict(row)
        result["questions"] = _loads(result.pop("questions_json")) or []
        return result


def get_quiz_history(student_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        if student_id:
            rows = conn.execute(
                "SELECT id, student_id, topic, student_level, difficulty, question_type, "
                "num_questions, created_at FROM quiz_history WHERE student_id = ? "
                "ORDER BY id DESC LIMIT ?",
                (student_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, student_id, topic, student_level, difficulty, question_type, "
                "num_questions, created_at FROM quiz_history ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


def save_quiz_attempt(
    quiz_id: int,
    answers: dict,
    score: float,
    total_questions: int,
    correct_count: int,
    incorrect_count: int,
    results: list,
    student_id: Optional[str] = None,
) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO quiz_attempts
               (quiz_id, student_id, answers_json, score, total_questions,
                correct_count, incorrect_count, results_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                quiz_id,
                student_id,
                _dumps(answers),
                score,
                total_questions,
                correct_count,
                incorrect_count,
                _dumps(results),
                _now(),
            ),
        )
        return int(cur.lastrowid)


def get_quiz_attempts(
    student_id: Optional[str] = None, quiz_id: Optional[int] = None, limit: int = 50
) -> list[dict]:
    with get_connection() as conn:
        query = "SELECT * FROM quiz_attempts WHERE 1=1"
        params: list = []
        if student_id:
            query += " AND student_id = ?"
            params.append(student_id)
        if quiz_id is not None:
            query += " AND quiz_id = ?"
            params.append(quiz_id)
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            row = dict(r)
            row["answers"] = _loads(row.pop("answers_json"))
            row["results"] = _loads(row.pop("results_json"))
            results.append(row)
        return results


# --------------------------------------------------------------------------
# Study plans
# --------------------------------------------------------------------------

def save_study_plan(
    goal: str,
    student_level: str,
    duration_days: int,
    hours_per_day: Optional[float],
    plan: dict,
    student_id: Optional[str] = None,
) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO study_plans
               (student_id, goal, student_level, duration_days, hours_per_day, plan_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (student_id, goal, student_level, duration_days, hours_per_day, _dumps(plan), _now()),
        )
        return int(cur.lastrowid)


def get_study_plans(student_id: Optional[str] = None, limit: int = 20) -> list[dict]:
    with get_connection() as conn:
        if student_id:
            rows = conn.execute(
                "SELECT * FROM study_plans WHERE student_id = ? ORDER BY id DESC LIMIT ?",
                (student_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM study_plans ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        results = []
        for r in rows:
            row = dict(r)
            row["plan"] = _loads(row.pop("plan_json"))
            results.append(row)
        return results


# --------------------------------------------------------------------------
# Student profiles
# --------------------------------------------------------------------------

def upsert_student_profile(
    student_id: str,
    name: Optional[str] = None,
    student_level: Optional[str] = None,
    preferences: Optional[dict] = None,
) -> None:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM student_profiles WHERE student_id = ?", (student_id,)
        ).fetchone()
        now = _now()
        if existing:
            conn.execute(
                """UPDATE student_profiles
                   SET name = COALESCE(?, name),
                       student_level = COALESCE(?, student_level),
                       preferences_json = COALESCE(?, preferences_json),
                       updated_at = ?
                   WHERE student_id = ?""",
                (
                    name,
                    student_level,
                    _dumps(preferences) if preferences is not None else None,
                    now,
                    student_id,
                ),
            )
        else:
            conn.execute(
                """INSERT INTO student_profiles
                   (student_id, name, student_level, preferences_json, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    student_id,
                    name,
                    student_level,
                    _dumps(preferences) if preferences is not None else None,
                    now,
                    now,
                ),
            )


def get_student_profile(student_id: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM student_profiles WHERE student_id = ?", (student_id,)
        ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["preferences"] = _loads(result.pop("preferences_json"))
        return result


# --------------------------------------------------------------------------
# Learning progress
# --------------------------------------------------------------------------

def update_learning_progress(
    student_id: str, topic: str, mastery_score: float, notes: Optional[str] = None
) -> None:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM learning_progress WHERE student_id = ? AND topic = ?",
            (student_id, topic),
        ).fetchone()
        now = _now()
        if existing:
            conn.execute(
                """UPDATE learning_progress
                   SET mastery_score = ?, attempts_count = attempts_count + 1,
                       last_activity = ?, notes = COALESCE(?, notes)
                   WHERE id = ?""",
                (mastery_score, now, notes, existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO learning_progress
                   (student_id, topic, mastery_score, attempts_count, last_activity, notes)
                   VALUES (?, ?, ?, 1, ?, ?)""",
                (student_id, topic, mastery_score, now, notes),
            )


def get_learning_progress(student_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM learning_progress WHERE student_id = ? ORDER BY last_activity DESC",
            (student_id,),
        ).fetchall()
        return [dict(r) for r in rows]