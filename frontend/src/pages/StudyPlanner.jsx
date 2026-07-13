import { useState } from 'react'
import { api } from '../api/client.js'
import Loader from '../components/Loader.jsx'

export default function StudyPlanner() {
  const [subjectsInput, setSubjectsInput] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('3')
  const [examDate, setExamDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)

  const todayStr = new Date().toISOString().split('T')[0]

  const handleGenerate = async (e) => {
    e.preventDefault()
    const subjects = subjectsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (subjects.length === 0 || !hoursPerDay || !examDate) return

    setLoading(true)
    setError('')
    setPlan(null)
    try {
      const data = await api.planner(subjects, parseFloat(hoursPerDay), examDate)
      setPlan(data)
    } catch (err) {
      setError(err.message || 'Could not generate study plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSubjectsInput('')
    setHoursPerDay('3')
    setExamDate('')
    setPlan(null)
    setError('')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          <span className="gradient-text">Study Planner</span> 📅
        </h1>
        <p className="text-slate-400">
          Enter your subjects, available hours, and exam date to get a personalized daily timetable.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="glass-card p-6 sm:p-8 mb-8 space-y-5">
        <div>
          <label htmlFor="subjects" className="block text-sm font-medium text-slate-300 mb-2">
            Subjects <span className="text-slate-500">(comma-separated)</span>
          </label>
          <input
            id="subjects"
            type="text"
            className="input-glass"
            placeholder="e.g. Math, Physics, Chemistry, English"
            value={subjectsInput}
            onChange={(e) => setSubjectsInput(e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="hours" className="block text-sm font-medium text-slate-300 mb-2">
              Hours available per day
            </label>
            <input
              id="hours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              className="input-glass"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="examDate" className="block text-sm font-medium text-slate-300 mb-2">
              Exam date
            </label>
            <input
              id="examDate"
              type="date"
              min={todayStr}
              className="input-glass"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="btn-primary flex-1 sm:flex-none"
            disabled={loading || !subjectsInput.trim() || !examDate}
          >
            {loading ? 'Generating...' : '📆 Generate Timetable'}
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            Reset
          </button>
        </div>
      </form>

      {loading && <Loader label="Building your personalized study plan..." />}

      {plan && !loading && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-indigo-300 mb-2">📋 Overview</h3>
            <p className="text-slate-300 leading-relaxed">{plan.overview}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {plan.days?.map((day, i) => (
              <div key={i} className="glass-card-hover p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-100">{day.day_label || `Day ${i + 1}`}</h4>
                  <span className="text-xs text-slate-500">{day.date}</span>
                </div>
                <div className="space-y-3">
                  {day.sessions?.map((s, j) => (
                    <div key={j} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-indigo-300 text-sm">{s.subject}</span>
                        <span className="text-xs text-slate-400">{s.duration_hours}h</span>
                      </div>
                      <p className="text-xs text-slate-400">{s.focus}</p>
                      {s.tip && <p className="text-xs text-slate-500 mt-1 italic">💡 {s.tip}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
