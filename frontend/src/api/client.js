const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message = data?.detail || `Request failed with status ${res.status}`
    throw new Error(message)
  }

  return data
}

export const api = {
  health: () => request('/api/health'),

  teacher: (topic) =>
    request('/api/teacher', {
      method: 'POST',
      body: JSON.stringify({ topic }),
    }),

  generateQuiz: (topic, num_questions = 10) =>
    request('/api/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ topic, num_questions }),
    }),

  submitQuiz: (topic, questions, answers) =>
    request('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ topic, questions, answers }),
    }),

  planner: (subjects, hours_per_day, exam_date) =>
    request('/api/planner', {
      method: 'POST',
      body: JSON.stringify({ subjects, hours_per_day, exam_date }),
    }),
}
