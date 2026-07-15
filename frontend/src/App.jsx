import React, { useState, useCallback, useRef } from "react";

/* =========================================================================
   EduVerse AI Pro — Drafted.jsx
   Single-file production component: AI Teacher, Quiz Generator, Study Planner
   Talks directly to the existing FastAPI backend via fetch().
   API base URL comes from import.meta.env.VITE_API_URL (no localhost).
   ========================================================================= */

const API_URL = import.meta.env.VITE_API_URL;

const STUDENT_LEVELS = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "CBSE", "ICSE", "JEE Main", "JEE Advanced", "NEET", "College",
];
const EXPLANATION_LENGTHS = ["Short", "Medium", "Detailed", "Comprehensive"];
const QUIZ_DIFFICULTIES = ["Easy", "Moderate", "Hard"];
const QUIZ_TYPES = ["MCQ", "True/False", "Short Answer"];

/* ------------------------------- helpers -------------------------------- */

async function callApi(path, payload) {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured. Set it in your environment.");
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseErr) {
    // no-op, handled below
  }

  if (!response.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : "Something went wrong. Please try again.");
  }
  return data;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeText(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    return item.text || item.value || item.point || item.formula || item.name || JSON.stringify(item);
  }
  return String(item);
}

function normalizeFlashcard(card, idx) {
  if (typeof card === "string") return { id: idx, front: card, back: "" };
  if (card && typeof card === "object") {
    return {
      id: idx,
      front: card.question || card.front || card.term || card.q || `Card ${idx + 1}`,
      back: card.answer || card.back || card.definition || card.a || "",
    };
  }
  return { id: idx, front: String(card), back: "" };
}

function normalizeQuizQuestion(q, idx) {
  const options =
    q.options || q.choices || q.answers_list || (q.answer_options ? q.answer_options : null);
  return {
    id: q.id !== undefined ? q.id : idx,
    question: q.question || q.text || q.prompt || `Question ${idx + 1}`,
    options: Array.isArray(options) ? options : null,
    raw: q,
  };
}

/* ------------------------------ small UI -------------------------------- */

function Spinner({ label }) {
  return (
    <div className="ev-spinner-wrap" role="status" aria-live="polite">
      <div className="ev-spinner" />
      {label && <p className="ev-spinner-label">{label}</p>}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="ev-error" role="alert">
      <span className="ev-error-icon">!</span>
      <span className="ev-error-text">{message}</span>
      {onDismiss && (
        <button className="ev-error-close" onClick={onDismiss} aria-label="Dismiss error">
          ×
        </button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="ev-field">
      <span className="ev-field-label">{label}</span>
      {children}
    </label>
  );
}

function SelectInput({ value, onChange, options, id }) {
  return (
    <select id={id} className="ev-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function Pill({ children }) {
  return <span className="ev-pill">{children}</span>;
}

function Collapsible({ title, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`ev-collapsible ${open ? "is-open" : ""}`}>
      <button className="ev-collapsible-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className="ev-collapsible-chevron">⌄</span>
      </button>
      {open && <div className="ev-collapsible-body">{children}</div>}
    </div>
  );
}

function FlipCard({ front, back }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`ev-flipcard ${flipped ? "is-flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      aria-label="Flashcard, tap to flip"
    >
      <div className="ev-flipcard-inner">
        <div className="ev-flipcard-face ev-flipcard-front">
          <span className="ev-flipcard-tag">Question</span>
          <p>{front}</p>
        </div>
        <div className="ev-flipcard-face ev-flipcard-back">
          <span className="ev-flipcard-tag">Answer</span>
          <p>{back || "No answer provided."}</p>
        </div>
      </div>
    </button>
  );
}

/* ============================== AI TEACHER =============================== */

function TeacherPanel() {
  const [topic, setTopic] = useState("");
  const [studentLevel, setStudentLevel] = useState(STUDENT_LEVELS[4]);
  const [length, setLength] = useState(EXPLANATION_LENGTHS[2]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [activeLevel, setActiveLevel] = useState("beginner");

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      setError("Enter a topic before generating an explanation.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await callApi("/api/teacher", {
        topic: topic.trim(),
        student_level: studentLevel,
        explanation_length: length,
      });
      setResult(data);
      setActiveLevel("beginner");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topic, studentLevel, length]);

  const explanationTabs = [
    { key: "beginner", label: "Beginner", text: result?.beginner_explanation },
    { key: "intermediate", label: "Intermediate", text: result?.intermediate_explanation },
    { key: "advanced", label: "Advanced", text: result?.advanced_explanation },
  ];

  return (
    <div className="ev-panel">
      <div className="ev-card ev-form-card">
        <Field label="Topic">
          <input
            className="ev-input"
            type="text"
            placeholder="e.g. Newton's Laws of Motion"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
        </Field>
        <div className="ev-form-row">
          <Field label="Student level">
            <SelectInput value={studentLevel} onChange={setStudentLevel} options={STUDENT_LEVELS} />
          </Field>
          <Field label="Explanation length">
            <SelectInput value={length} onChange={setLength} options={EXPLANATION_LENGTHS} />
          </Field>
        </div>
        <button className="ev-btn ev-btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : "Generate explanation"}
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {loading && <Spinner label="EduVerse AI is preparing your explanation…" />}

      {result && !loading && (
        <div className="ev-results ev-fade-in">
          <div className="ev-card">
            <div className="ev-result-heading">
              <h3>{result.topic || topic}</h3>
              <Pill>{result.student_level || studentLevel}</Pill>
            </div>

            <div className="ev-tabbar">
              {explanationTabs.map((t) => (
                <button
                  key={t.key}
                  className={`ev-tab ${activeLevel === t.key ? "is-active" : ""}`}
                  onClick={() => setActiveLevel(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ev-explanation-body">
              {explanationTabs.find((t) => t.key === activeLevel)?.text || "No explanation available for this level."}
            </div>
          </div>

          {result.summary && (
            <div className="ev-card">
              <h4 className="ev-section-title">Summary</h4>
              <p className="ev-summary-text">{result.summary}</p>
            </div>
          )}

          <div className="ev-grid-2">
            {asArray(result.key_points).length > 0 && (
              <div className="ev-card">
                <h4 className="ev-section-title">Key points</h4>
                <ul className="ev-list">
                  {asArray(result.key_points).map((p, i) => (
                    <li key={i}>{normalizeText(p)}</li>
                  ))}
                </ul>
              </div>
            )}

            {asArray(result.important_formulas).length > 0 && (
              <div className="ev-card">
                <h4 className="ev-section-title">Important formulas</h4>
                <ul className="ev-list ev-list-mono">
                  {asArray(result.important_formulas).map((f, i) => (
                    <li key={i}>{normalizeText(f)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {asArray(result.examples).length > 0 && (
            <div className="ev-card">
              <h4 className="ev-section-title">Examples</h4>
              <div className="ev-examples">
                {asArray(result.examples).map((ex, i) => (
                  <div key={i} className="ev-example-item">
                    <span className="ev-example-index">{i + 1}</span>
                    <p>{normalizeText(ex)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {asArray(result.flashcards).length > 0 && (
            <div className="ev-card">
              <h4 className="ev-section-title">Flashcards</h4>
              <div className="ev-flashcard-grid">
                {asArray(result.flashcards).map((c, i) => {
                  const fc = normalizeFlashcard(c, i);
                  return <FlipCard key={fc.id} front={fc.front} back={fc.back} />;
                })}
              </div>
            </div>
          )}

          {asArray(result.practice_questions).length > 0 && (
            <div className="ev-card">
              <Collapsible title="Practice questions" defaultOpen={false}>
                <ul className="ev-list">
                  {asArray(result.practice_questions).map((q, i) => (
                    <li key={i}>{normalizeText(q)}</li>
                  ))}
                </ul>
              </Collapsible>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ QUIZ GENERATOR ============================= */

function QuizPanel() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(QUIZ_DIFFICULTIES[1]);
  const [questionType, setQuestionType] = useState(QUIZ_TYPES[0]);
  const [questionCount, setQuestionCount] = useState(10);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submission, setSubmission] = useState(null);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      setError("Enter a topic before generating a quiz.");
      return;
    }
    setLoading(true);
    setError("");
    setQuiz(null);
    setSubmission(null);
    setAnswers({});
    try {
      const data = await callApi("/api/quiz/generate", {
        topic: topic.trim(),
        difficulty,
        question_count: Number(questionCount) || 10,
        question_type: questionType,
      });
      const rawQuestions = data.questions || data.quiz || data.questions_list || [];
      setQuiz(data);
      setQuestions(asArray(rawQuestions).map(normalizeQuizQuestion));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, questionType, questionCount]);

  const selectAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  const submitQuiz = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        topic: topic.trim(),
        difficulty,
        question_type: questionType,
        questions: questions.map((q) => q.raw),
        answers: questions.map((q) => ({ id: q.id, question: q.question, selected: answers[q.id] })),
      };
      const data = await callApi("/api/quiz/submit", payload);
      setSubmission(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [topic, difficulty, questionType, questions, answers]);

  const score = submission?.score ?? submission?.total_score;
  const total = submission?.total ?? submission?.total_questions ?? questions.length;
  const results = asArray(submission?.results || submission?.details || submission?.review);

  return (
    <div className="ev-panel">
      <div className="ev-card ev-form-card">
        <Field label="Topic">
          <input
            className="ev-input"
            type="text"
            placeholder="e.g. Physics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
        <div className="ev-form-row ev-form-row-3">
          <Field label="Difficulty">
            <SelectInput value={difficulty} onChange={setDifficulty} options={QUIZ_DIFFICULTIES} />
          </Field>
          <Field label="Question type">
            <SelectInput value={questionType} onChange={setQuestionType} options={QUIZ_TYPES} />
          </Field>
          <Field label="Number of questions">
            <input
              className="ev-input"
              type="number"
              min={1}
              max={50}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
            />
          </Field>
        </div>
        <button className="ev-btn ev-btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Building quiz…" : "Generate quiz"}
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {loading && <Spinner label="Assembling your questions…" />}

      {questions.length > 0 && !loading && (
        <div className="ev-results ev-fade-in">
          <div className="ev-card">
            <div className="ev-result-heading">
              <h3>{quiz?.topic || topic}</h3>
              <div className="ev-pill-row">
                <Pill>{difficulty}</Pill>
                <Pill>{questionType}</Pill>
                <Pill>{questions.length} questions</Pill>
              </div>
            </div>
          </div>

          <div className="ev-quiz-list">
            {questions.map((q, idx) => (
              <div className="ev-card ev-quiz-item" key={q.id}>
                <p className="ev-quiz-question">
                  <span className="ev-quiz-number">{idx + 1}</span>
                  {q.question}
                </p>
                {q.options ? (
                  <div className="ev-quiz-options">
                    {q.options.map((opt, oi) => {
                      const optLabel = typeof opt === "string" ? opt : opt.text || opt.option || String(opt);
                      const isSelected = answers[q.id] === optLabel;
                      return (
                        <button
                          key={oi}
                          type="button"
                          className={`ev-option ${isSelected ? "is-selected" : ""}`}
                          onClick={() => selectAnswer(q.id, optLabel)}
                          disabled={!!submission}
                        >
                          <span className="ev-option-marker">{String.fromCharCode(65 + oi)}</span>
                          {optLabel}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    className="ev-input"
                    type="text"
                    placeholder="Type your answer"
                    value={answers[q.id] || ""}
                    onChange={(e) => selectAnswer(q.id, e.target.value)}
                    disabled={!!submission}
                  />
                )}

                {submission && results[idx] && (
                  <div
                    className={`ev-quiz-feedback ${
                      results[idx].is_correct || results[idx].correct ? "is-correct" : "is-incorrect"
                    }`}
                  >
                    <p>
                      <strong>Correct answer:</strong>{" "}
                      {results[idx].correct_answer || results[idx].answer || "—"}
                    </p>
                    {(results[idx].explanation || results[idx].reason) && (
                      <p className="ev-quiz-explanation">{results[idx].explanation || results[idx].reason}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!submission ? (
            <button
              className="ev-btn ev-btn-primary ev-btn-block"
              onClick={submitQuiz}
              disabled={!allAnswered || submitting}
            >
              {submitting ? "Submitting…" : allAnswered ? "Submit answers" : "Answer all questions to submit"}
            </button>
          ) : (
            <div className="ev-card ev-score-card ev-fade-in">
              <div className="ev-score-ring">
                <span className="ev-score-value">
                  {score !== undefined ? score : "—"}
                  {total ? <span className="ev-score-total">/{total}</span> : null}
                </span>
              </div>
              <div>
                <h4 className="ev-section-title">Quiz complete</h4>
                <p className="ev-summary-text">
                  {submission.message || submission.feedback || "Nice work — review the explanations above to strengthen weak spots."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================== AI STUDY PLANNER ============================= */

function PlannerPanel() {
  const [subject, setSubject] = useState("");
  const [goal, setGoal] = useState("");
  const [studentLevel, setStudentLevel] = useState(STUDENT_LEVELS[4]);
  const [durationDays, setDurationDays] = useState(30);
  const [hoursPerDay, setHoursPerDay] = useState(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  const generate = useCallback(async () => {
    if (!subject.trim() || !goal.trim()) {
      setError("Enter both a subject and a goal before generating a plan.");
      return;
    }
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const data = await callApi("/api/planner", {
        subject: subject.trim(),
        goal: goal.trim(),
        student_level: studentLevel,
        duration_days: Number(durationDays) || 30,
        hours_per_day: Number(hoursPerDay) || 1,
      });
      setPlan(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [subject, goal, studentLevel, durationDays, hoursPerDay]);

  const schedule = asArray(plan?.timetable || plan?.schedule || plan?.plan || plan?.days);

  return (
    <div className="ev-panel">
      <div className="ev-card ev-form-card">
        <div className="ev-form-row">
          <Field label="Subject">
            <input
              className="ev-input"
              type="text"
              placeholder="e.g. Math"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label="Goal">
            <input
              className="ev-input"
              type="text"
              placeholder="e.g. Board exams"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </Field>
        </div>
        <div className="ev-form-row ev-form-row-3">
          <Field label="Student level">
            <SelectInput value={studentLevel} onChange={setStudentLevel} options={STUDENT_LEVELS} />
          </Field>
          <Field label="Duration (days)">
            <input
              className="ev-input"
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </Field>
          <Field label="Hours per day">
            <input
              className="ev-input"
              type="number"
              min={1}
              max={12}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
            />
          </Field>
        </div>
        <button className="ev-btn ev-btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Building your plan…" : "Generate timetable"}
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {loading && <Spinner label="Mapping out your study path…" />}

      {plan && !loading && (
        <div className="ev-results ev-fade-in">
          <div className="ev-card">
            <div className="ev-result-heading">
              <h3>{plan.subject || subject}</h3>
              <div className="ev-pill-row">
                <Pill>{plan.goal || goal}</Pill>
                <Pill>{durationDays} days</Pill>
                <Pill>{hoursPerDay} hrs/day</Pill>
              </div>
            </div>
            {(plan.summary || plan.overview) && <p className="ev-summary-text">{plan.summary || plan.overview}</p>}
          </div>

          {schedule.length > 0 ? (
            <div className="ev-timeline">
              {schedule.map((day, i) => {
                const dayLabel = day.day || day.date || day.title || `Day ${i + 1}`;
                const focus = day.focus || day.topic || day.subject_focus;
                const tasksRaw = day.tasks || day.activities || day.plan || [];
                const tasks = asArray(tasksRaw);
                return (
                  <div className="ev-timeline-item" key={i}>
                    <div className="ev-timeline-marker">{i + 1}</div>
                    <div className="ev-card ev-timeline-card">
                      <div className="ev-timeline-head">
                        <h4>{dayLabel}</h4>
                        {focus && <Pill>{focus}</Pill>}
                      </div>
                      {tasks.length > 0 ? (
                        <ul className="ev-list">
                          {tasks.map((t, ti) => (
                            <li key={ti}>{normalizeText(t)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="ev-summary-text">{normalizeText(day)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ev-card">
              <p className="ev-summary-text">Your plan was generated, but no daily breakdown was returned.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================ SHELL =================================== */

const SECTIONS = [
  { key: "teacher", label: "AI Teacher", hint: "Explain any topic" },
  { key: "quiz", label: "Quiz Generator", hint: "Test what you know" },
  { key: "planner", label: "Study Planner", hint: "Plan your prep" },
];

export default function Drafted() {
  const [active, setActive] = useState("teacher");
  const mainRef = useRef(null);

  const handleSelect = (key) => {
    setActive(key);
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ev-root">
      <style>{CSS}</style>
      <div className="ev-aurora" aria-hidden="true" />

      <header className="ev-header">
        <div className="ev-brand">
          <div className="ev-brand-mark">EV</div>
          <div>
            <p className="ev-brand-name">EduVerse AI Pro</p>
            <p className="ev-brand-sub">Learn faster, guided by AI</p>
          </div>
        </div>
        <nav className="ev-nav" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`ev-nav-btn ${active === s.key ? "is-active" : ""}`}
              onClick={() => handleSelect(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="ev-main" ref={mainRef}>
        <div className="ev-main-inner">
          <div className="ev-hero">
            <h1>{SECTIONS.find((s) => s.key === active)?.label}</h1>
            <p>{SECTIONS.find((s) => s.key === active)?.hint}</p>
          </div>

          {active === "teacher" && <TeacherPanel />}
          {active === "quiz" && <QuizPanel />}
          {active === "planner" && <PlannerPanel />}
        </div>
      </main>

      <nav className="ev-tabbar-mobile" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`ev-tabbar-mobile-btn ${active === s.key ? "is-active" : ""}`}
            onClick={() => handleSelect(s.key)}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ================================== CSS ==================================== */

const CSS = `
:root {
  --ev-bg: #0a0e1a;
  --ev-surface: rgba(255,255,255,0.05);
  --ev-surface-solid: #131829;
  --ev-border: rgba(255,255,255,0.09);
  --ev-text: #eef0f8;
  --ev-text-dim: #9aa2c4;
  --ev-primary: #7c6cf0;
  --ev-primary-dim: #574be0;
  --ev-teal: #14d9c4;
  --ev-amber: #ffb020;
  --ev-danger: #ff6b81;
  --ev-radius: 18px;
  --ev-font-display: 'Sora', 'Space Grotesk', 'Segoe UI', sans-serif;
  --ev-font-body: 'Inter', 'Segoe UI', sans-serif;
  --ev-font-mono: 'JetBrains Mono', 'Courier New', monospace;
}

.ev-root {
  position: relative;
  min-height: 100vh;
  background: var(--ev-bg);
  color: var(--ev-text);
  font-family: var(--ev-font-body);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.ev-aurora {
  position: fixed;
  inset: -20%;
  z-index: 0;
  background:
    radial-gradient(40% 35% at 20% 15%, rgba(124,108,240,0.35), transparent 60%),
    radial-gradient(35% 30% at 85% 10%, rgba(20,217,196,0.22), transparent 60%),
    radial-gradient(45% 40% at 60% 90%, rgba(124,108,240,0.18), transparent 60%);
  filter: blur(60px);
  animation: ev-drift 22s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes ev-drift {
  0% { transform: translate3d(0,0,0) scale(1); }
  100% { transform: translate3d(-2%, 2%, 0) scale(1.05); }
}

.ev-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid var(--ev-border);
  background: rgba(10,14,26,0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
}

.ev-brand { display: flex; align-items: center; gap: 12px; }
.ev-brand-mark {
  width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--ev-font-display);
  font-weight: 700;
  background: linear-gradient(135deg, var(--ev-primary), var(--ev-teal));
  color: #0a0e1a;
  box-shadow: 0 8px 24px rgba(124,108,240,0.35);
}
.ev-brand-name {
  font-family: var(--ev-font-display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.2px;
  margin: 0;
}
.ev-brand-sub { margin: 0; font-size: 12px; color: var(--ev-text-dim); }

.ev-nav { display: flex; gap: 6px; background: var(--ev-surface); border: 1px solid var(--ev-border); padding: 4px; border-radius: 999px; }
.ev-nav-btn {
  border: none; background: transparent; color: var(--ev-text-dim);
  font-family: var(--ev-font-body); font-size: 13.5px; font-weight: 600;
  padding: 9px 16px; border-radius: 999px; cursor: pointer;
  transition: color .2s ease, background .2s ease;
}
.ev-nav-btn.is-active { color: #0a0e1a; background: linear-gradient(135deg, var(--ev-primary), var(--ev-teal)); }
.ev-nav-btn:not(.is-active):hover { color: var(--ev-text); background: rgba(255,255,255,0.06); }

.ev-main { position: relative; z-index: 1; flex: 1; overflow-y: auto; }
.ev-main-inner { max-width: 920px; margin: 0 auto; padding: 36px 24px 100px; }

.ev-hero { margin-bottom: 26px; }
.ev-hero h1 {
  font-family: var(--ev-font-display);
  font-size: clamp(26px, 4vw, 34px);
  margin: 0 0 4px;
  background: linear-gradient(90deg, #fff, var(--ev-text-dim));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ev-hero p { margin: 0; color: var(--ev-text-dim); font-size: 14.5px; }

.ev-panel { display: flex; flex-direction: column; gap: 20px; }

.ev-card {
  background: var(--ev-surface);
  border: 1px solid var(--ev-border);
  border-radius: var(--ev-radius);
  padding: 22px;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
}

.ev-form-card { display: flex; flex-direction: column; gap: 16px; }
.ev-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ev-form-row-3 { grid-template-columns: 1fr 1fr 1fr; }

.ev-field { display: flex; flex-direction: column; gap: 6px; }
.ev-field-label { font-size: 12.5px; font-weight: 600; color: var(--ev-text-dim); letter-spacing: 0.3px; }

.ev-input, .ev-select {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--ev-border);
  color: var(--ev-text);
  font-family: var(--ev-font-body);
  font-size: 14.5px;
  padding: 11px 14px;
  border-radius: 12px;
  outline: none;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.ev-input::placeholder { color: rgba(255,255,255,0.3); }
.ev-input:focus, .ev-select:focus { border-color: var(--ev-primary); box-shadow: 0 0 0 3px rgba(124,108,240,0.25); }
.ev-select { appearance: none; cursor: pointer; }

.ev-btn {
  border: none; cursor: pointer;
  font-family: var(--ev-font-body); font-weight: 700; font-size: 14.5px;
  padding: 13px 20px; border-radius: 12px;
  transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.ev-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ev-btn-primary {
  background: linear-gradient(135deg, var(--ev-primary), var(--ev-teal));
  color: #0a0e1a;
  box-shadow: 0 10px 26px rgba(124,108,240,0.3);
}
.ev-btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(124,108,240,0.4); }
.ev-btn-block { width: 100%; }

.ev-spinner-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 34px 0; }
.ev-spinner {
  width: 38px; height: 38px; border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.12);
  border-top-color: var(--ev-primary);
  border-right-color: var(--ev-teal);
  animation: ev-spin 0.9s linear infinite;
}
@keyframes ev-spin { to { transform: rotate(360deg); } }
.ev-spinner-label { color: var(--ev-text-dim); font-size: 13.5px; }

.ev-error {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,107,129,0.12);
  border: 1px solid rgba(255,107,129,0.35);
  color: #ffcdd6;
  padding: 12px 14px; border-radius: 12px; font-size: 13.5px;
}
.ev-error-icon {
  width: 20px; height: 20px; border-radius: 50%; background: var(--ev-danger);
  color: #2a0510; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 12px; flex-shrink: 0;
}
.ev-error-text { flex: 1; }
.ev-error-close { background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; line-height: 1; }

.ev-fade-in { animation: ev-fade .35s ease; }
@keyframes ev-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.ev-results { display: flex; flex-direction: column; gap: 18px; }

.ev-result-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.ev-result-heading h3 { margin: 0; font-family: var(--ev-font-display); font-size: 19px; }

.ev-pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
.ev-pill {
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.3px;
  padding: 5px 11px; border-radius: 999px;
  background: rgba(124,108,240,0.16); color: #cfc9ff;
  border: 1px solid rgba(124,108,240,0.3);
  white-space: nowrap;
}

.ev-tabbar { display: flex; gap: 6px; margin-bottom: 14px; background: rgba(255,255,255,0.04); padding: 4px; border-radius: 12px; }
.ev-tab {
  flex: 1; border: none; background: transparent; color: var(--ev-text-dim);
  font-weight: 600; font-size: 13px; padding: 9px 10px; border-radius: 9px; cursor: pointer;
  transition: all .2s ease;
}
.ev-tab.is-active { background: rgba(255,255,255,0.09); color: var(--ev-text); }
.ev-explanation-body { font-size: 14.5px; line-height: 1.7; color: var(--ev-text); white-space: pre-wrap; }

.ev-section-title { font-family: var(--ev-font-display); font-size: 15.5px; margin: 0 0 12px; color: var(--ev-text); }
.ev-summary-text { font-size: 14px; line-height: 1.7; color: var(--ev-text-dim); margin: 0; }

.ev-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

.ev-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.55; color: var(--ev-text); }
.ev-list-mono { font-family: var(--ev-font-mono); font-size: 13px; }

.ev-examples { display: flex; flex-direction: column; gap: 12px; }
.ev-example-item { display: flex; gap: 12px; align-items: flex-start; }
.ev-example-index {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 8px;
  background: rgba(20,217,196,0.15); color: var(--ev-teal);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
}
.ev-example-item p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--ev-text); }

.ev-flashcard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
.ev-flipcard { perspective: 1000px; background: none; border: none; cursor: pointer; padding: 0; height: 140px; }
.ev-flipcard-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d; transition: transform .5s ease;
}
.ev-flipcard.is-flipped .ev-flipcard-inner { transform: rotateY(180deg); }
.ev-flipcard-face {
  position: absolute; inset: 0; border-radius: 14px;
  backface-visibility: hidden; padding: 14px;
  display: flex; flex-direction: column; gap: 6px; justify-content: center;
  border: 1px solid var(--ev-border);
  text-align: left;
}
.ev-flipcard-front { background: rgba(124,108,240,0.1); }
.ev-flipcard-back { background: rgba(20,217,196,0.1); transform: rotateY(180deg); }
.ev-flipcard-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ev-text-dim); }
.ev-flipcard-face p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ev-text); }

.ev-collapsible-head {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  background: none; border: none; color: var(--ev-text); font-family: var(--ev-font-display);
  font-size: 15.5px; cursor: pointer; padding: 0;
}
.ev-collapsible-chevron { transition: transform .2s ease; color: var(--ev-text-dim); }
.ev-collapsible.is-open .ev-collapsible-chevron { transform: rotate(180deg); }
.ev-collapsible-body { margin-top: 14px; }

.ev-quiz-list { display: flex; flex-direction: column; gap: 14px; }
.ev-quiz-item { display: flex; flex-direction: column; gap: 14px; }
.ev-quiz-question { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; font-weight: 600; margin: 0; }
.ev-quiz-number {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
  background: rgba(124,108,240,0.18); color: #cfc9ff;
  display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 800;
}
.ev-quiz-options { display: flex; flex-direction: column; gap: 8px; }
.ev-option {
  display: flex; align-items: center; gap: 10px; text-align: left;
  background: rgba(255,255,255,0.03); border: 1px solid var(--ev-border);
  color: var(--ev-text); font-size: 14px; padding: 11px 14px; border-radius: 12px;
  cursor: pointer; transition: all .15s ease;
}
.ev-option:hover:not(:disabled) { border-color: rgba(124,108,240,0.5); background: rgba(124,108,240,0.08); }
.ev-option.is-selected { border-color: var(--ev-primary); background: rgba(124,108,240,0.18); }
.ev-option:disabled { cursor: default; opacity: 0.85; }
.ev-option-marker {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
  background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}

.ev-quiz-feedback { border-radius: 12px; padding: 12px 14px; font-size: 13.5px; }
.ev-quiz-feedback.is-correct { background: rgba(20,217,196,0.12); border: 1px solid rgba(20,217,196,0.35); }
.ev-quiz-feedback.is-incorrect { background: rgba(255,107,129,0.1); border: 1px solid rgba(255,107,129,0.3); }
.ev-quiz-feedback p { margin: 0 0 4px; }
.ev-quiz-explanation { color: var(--ev-text-dim); }

.ev-score-card { display: flex; align-items: center; gap: 20px; }
.ev-score-ring {
  flex-shrink: 0; width: 84px; height: 84px; border-radius: 50%;
  background: conic-gradient(var(--ev-teal) 0deg, var(--ev-primary) 360deg);
  display: flex; align-items: center; justify-content: center;
  padding: 6px;
}
.ev-score-ring::before {
  content: ''; position: absolute;
}
.ev-score-value {
  width: 100%; height: 100%; border-radius: 50%; background: var(--ev-surface-solid);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--ev-font-mono); font-weight: 700; font-size: 18px;
}
.ev-score-total { font-size: 12px; color: var(--ev-text-dim); margin-left: 2px; }

.ev-timeline { position: relative; display: flex; flex-direction: column; gap: 16px; padding-left: 6px; }
.ev-timeline-item { display: flex; gap: 14px; }
.ev-timeline-marker {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, var(--ev-primary), var(--ev-teal));
  color: #0a0e1a; font-weight: 800; font-size: 12.5px;
  display: flex; align-items: center; justify-content: center;
}
.ev-timeline-card { flex: 1; padding: 16px 18px; }
.ev-timeline-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.ev-timeline-head h4 { margin: 0; font-family: var(--ev-font-display); font-size: 14.5px; }

.ev-tabbar-mobile { display: none; }

@media (max-width: 760px) {
  .ev-header { padding: 14px 16px; }
  .ev-nav { display: none; }
  .ev-main-inner { padding: 22px 14px 96px; }
  .ev-form-row, .ev-form-row-3 { grid-template-columns: 1fr; }
  .ev-grid-2 { grid-template-columns: 1fr; }
  .ev-brand-sub { display: none; }

  .ev-tabbar-mobile {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 5;
    background: rgba(10,14,26,0.85); backdrop-filter: blur(16px);
    border-top: 1px solid var(--ev-border);
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  }
  .ev-tabbar-mobile-btn {
    flex: 1; background: none; border: none; color: var(--ev-text-dim);
    font-size: 12px; font-weight: 600; padding: 8px 4px; border-radius: 10px; cursor: pointer;
  }
  .ev-tabbar-mobile-btn.is-active { color: #0a0e1a; background: linear-gradient(135deg, var(--ev-primary), var(--ev-teal)); }
}
`;