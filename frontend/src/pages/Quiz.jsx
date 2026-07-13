import { useState } from 'react'
import { api } from '../api/client.js'
import Loader from '../components/Loader.jsx'

const STAGE = {
  INPUT: 'input',
  TAKING: 'taking',
  RESULTS: 'results',
}

export default function Quiz() {
  const [topic, setTopic] = useState('')
  const [stage, setStage] = useState(STAGE.INPUT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])
  const [selections, setSelections] = useState({})
  const [results, setResults] = useState(null)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api.generateQuiz(topic.trim(), 10)
      setQuestions(data.questions)
      setSelections({})
      setStage(STAGE.TAKING)
    } catch (err) {
      setError(err.message || 'Could not generate quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (qIndex, option) => {
    setSelections((prev) => ({ ...prev, [qIndex]: option }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const answers = Object.entries(selections).map(([question_index, selected_option]) => ({
        question_index: Number(question_index),
        selected_option,
      }))
      const data = await api.submitQuiz(topic.trim(), questions, answers)
      setResults(data)
      setStage(STAGE.RESULTS)
    } catch (err) {
      setError(err.message || 'Could not submit quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = () => {
    setStage(STAGE.INPUT)
    setTopic('')
    setQuestions([])
    setSelections({})
    setResults(null)
    setError('')
  }

  const answeredCount = Object.keys(selections).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          <span className="gradient-text">AI Quiz</span> 📝
        </h1>
        <p className="text-slate-400">Test your knowledge with a fresh 10-question quiz on any topic.</p>
      </div>

      {stage === STAGE.INPUT && (
        <form onSubmit={handleGenerate} className="glass-card p-6 sm:p-8">
          <label htmlFor="quiz-topic" className="block text-sm font-medium text-slate-300 mb-2">
            Topic
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="quiz-topic"
              type="text"
              className="input-glass flex-1"
              placeholder="e.g. World War II, Algebra, Human Anatomy..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading || !topic.trim()}>
              {loading ? 'Generating...' : '🎯 Generate Quiz'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </form>
      )}

      {loading && stage === STAGE.INPUT && <Loader label="Building your quiz..." />}

      {stage === STAGE.TAKING && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between glass-card px-5 py-3">
            <span className="text-sm text-slate-300">
              📚 Topic: <span className="font-semibold text-slate-100">{topic}</span>
            </span>
            <span className="text-sm text-indigo-300 font-medium">
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {questions.map((q, i) => (
            <div key={i} className="glass-card p-6">
              <p className="font-medium text-slate-200 mb-4">
                {i + 1}. {q.question}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {q.options.map((opt, j) => {
                  const isSelected = selections[i] === opt
                  return (
                    <button
                      key={j}
                      onClick={() => handleSelect(i, opt)}
                      className={`text-left text-sm rounded-xl px-4 py-3 border transition-all duration-200 ${
                        isSelected
                          ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-200 ring-2 ring-indigo-500/30'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-center pt-2">
            <button
              onClick={handleSubmit}
              className="btn-primary text-base px-8 py-4"
              disabled={loading || answeredCount === 0}
            >
              {loading ? 'Scoring...' : '✅ Submit Quiz'}
            </button>
          </div>
        </div>
      )}

      {loading && stage === STAGE.TAKING && <Loader label="Scoring your quiz..." />}

      {stage === STAGE.RESULTS && results && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="glass-card p-8 text-center">
            <p className="text-slate-400 mb-2">Your Score</p>
            <p className="text-5xl font-extrabold gradient-text mb-2">
              {results.score}/{results.total}
            </p>
            <p className="text-2xl font-semibold text-slate-200">{results.percentage}%</p>
          </div>

          <div className="space-y-4">
            {results.results.map((r, i) => (
              <div
                key={i}
                className={`glass-card p-5 border-l-4 ${
                  r.is_correct ? 'border-l-emerald-400' : 'border-l-red-400'
                }`}
              >
                <p className="font-medium text-slate-200 mb-2">
                  {i + 1}. {r.question}
                </p>
                <p className="text-sm text-slate-400">
                  Your answer:{' '}
                  <span className={r.is_correct ? 'text-emerald-300' : 'text-red-300'}>
                    {r.selected_option || 'Not answered'}
                  </span>
                </p>
                {!r.is_correct && (
                  <p className="text-sm text-emerald-300 mt-1">Correct answer: {r.correct_answer}</p>
                )}
                {r.explanation && <p className="text-xs text-slate-500 mt-2">{r.explanation}</p>}
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <button onClick={handleRestart} className="btn-primary text-base px-8 py-4">
              🔁 Restart Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
