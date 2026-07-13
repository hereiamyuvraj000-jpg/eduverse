import { useState } from 'react'
import { api } from '../api/client.js'
import Loader from '../components/Loader.jsx'
function speakText(text) {
  const speech = new SpeechSynthesisUtterance(text)
  speech.lang = 'en-US'
  window.speechSynthesis.speak(speech)
}

function buildCopyText(result) {
  if (!result) return ''
  const lines = []
  lines.push(`TOPIC: ${result.topic}`)
  lines.push('')
  lines.push('EASY EXPLANATION')
  lines.push(result.easy_explanation)
  lines.push('')
  lines.push('KEY POINTS')
  result.key_points.forEach((p, i) => lines.push(`${i + 1}. ${p}`))
  lines.push('')
  lines.push('EXAMPLES')
  result.examples.forEach((e, i) => lines.push(`${i + 1}. ${e}`))
  lines.push('')
  lines.push('QUIZ QUESTIONS')
  result.quiz_questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question}`)
    q.options.forEach((opt) => lines.push(`   - ${opt}`))
    lines.push(`   Answer: ${q.correct_answer}`)
  })
  lines.push('')
  lines.push('SUMMARY')
  lines.push(result.summary)
  return lines.join('\n')
}

export default function AITeacher() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.teacher(topic.trim())
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setTopic('')
    setResult(null)
    setError('')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(result))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          <span className="gradient-text">AI Teacher</span> 🧠
        </h1>
        <p className="text-slate-400">
          Enter any topic and get a full lesson: explanation, key points, examples, quiz &amp; summary.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="glass-card p-6 sm:p-8 mb-8">
        <label htmlFor="topic" className="block text-sm font-medium text-slate-300 mb-2">
          Topic
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="topic"
            type="text"
            className="input-glass flex-1"
            placeholder="e.g. Photosynthesis, Newton's Laws, French Revolution..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading || !topic.trim()}>
            {loading ? 'Generating...' : '✨ Generate Lesson'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </form>

      {loading && <Loader label="Your AI teacher is preparing the lesson..." />}

      {result && !loading && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-100">
              📘 Lesson: <span className="gradient-text">{result.topic}</span>
            </h2>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary text-sm py-2 px-4">
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
              <button onClick={handleClear} className="btn-secondary text-sm py-2 px-4">
                🗑️ Clear
              </button>
            </div>
          </div>

          <div className="glass-card p-6">
  <h3 className="text-lg font-semibold text-indigo-300 mb-3">💡 Easy Explanation</h3>

  <p className="text-slate-300 leading-relaxed">
    {result.easy_explanation}
  </p>

  <button
    onClick={() => speakText(result.easy_explanation)}
    className="btn-secondary text-sm py-2 px-4 mt-4"
  >
    🔊 Listen
  </button>
</div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-indigo-300 mb-3">🔑 Key Points</h3>
            <ul className="space-y-2">
              {result.key_points.map((point, i) => (
                <li key={i} className="flex gap-3 text-slate-300">
                  <span className="text-indigo-400 font-bold">{i + 1}.</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-indigo-300 mb-3">🌟 Examples</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {result.examples.map((ex, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-300">
                  {ex}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-indigo-300 mb-4">❓ Quiz Questions</h3>
            <div className="space-y-5">
              {result.quiz_questions.map((q, i) => (
                <div key={i} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <p className="font-medium text-slate-200 mb-2">
                    {i + 1}. {q.question}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((opt, j) => (
                      <div
                        key={j}
                        className={`text-sm rounded-lg px-3 py-2 border ${
                          opt === q.correct_answer
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 border-indigo-400/20">
            <h3 className="text-lg font-semibold text-indigo-300 mb-3">📝 Summary</h3>
            <p className="text-slate-300 leading-relaxed">{result.summary}</p>
          </div>
        </div>
      )}
    </div>
  )
}
