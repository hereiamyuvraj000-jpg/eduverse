import { Link } from 'react-router-dom'

const features = [
  {
    icon: '🧠',
    title: 'AI Teacher',
    desc: 'Enter any topic and get an easy explanation, key points, real-world examples, and a mini quiz — instantly.',
  },
  {
    icon: '📝',
    title: 'AI Quiz Generator',
    desc: 'Generate a fresh 10-question multiple choice quiz on any subject and get scored instantly with explanations.',
  },
  {
    icon: '📅',
    title: 'Smart Study Planner',
    desc: 'Tell it your subjects, hours, and exam date — get a personalized day-by-day study timetable.',
  },
  {
    icon: '⚡',
    title: 'Instant & Responsive',
    desc: 'A fast, modern interface that works beautifully on desktop, tablet, and mobile.',
  },
  {
    icon: '🎨',
    title: 'Futuristic Design',
    desc: 'Glassmorphism, gradients, and smooth animations make studying feel like the future.',
  },
  {
    icon: '🔒',
    title: 'Your Own AI Key',
    desc: 'Bring your own OpenRouter API key — full control over cost, privacy, and the model you use.',
  },
]

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-glow pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase glass-card text-indigo-300 mb-6">
              ✨ Powered by AI
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              Learn Anything with your{' '}
              <span className="gradient-text">Personal AI Tutor</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
              EduVerse AI Lite explains topics, generates quizzes, and builds study plans —
              instantly, beautifully, and personalized just for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/ai-teacher" className="btn-primary text-base px-8 py-4">
                🚀 Start Learning
              </Link>
              <Link to="/study-planner" className="btn-secondary text-base px-8 py-4">
                Plan My Studies
              </Link>
            </div>
          </div>

          {/* Floating decorative cards */}
          <div className="hidden lg:block absolute top-24 left-4 glass-card px-4 py-3 animate-float">
            <p className="text-xs text-slate-300">🧪 Explaining Photosynthesis...</p>
          </div>
          <div className="hidden lg:block absolute bottom-8 right-4 glass-card px-4 py-3 animate-float" style={{ animationDelay: '1.5s' }}>
            <p className="text-xs text-slate-300">✅ Quiz Score: 90%</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to <span className="gradient-text">study smarter</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Three focused AI tools, one seamless experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="glass-card-hover p-6 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-slate-100">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass-card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold mb-6">
              About <span className="gradient-text">EduVerse AI Lite</span>
            </h2>
            <p className="text-slate-400 leading-relaxed max-w-2xl mx-auto">
              EduVerse AI Lite is a lightweight, open, full-stack demo of what modern AI-assisted
              education can look like. It combines a React + Tailwind frontend with a FastAPI
              backend and an OpenRouter-powered AI engine to deliver instant explanations,
              quizzes, and study plans — all running entirely on your own machine, under your
              own control.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">Ready to level up your learning?</h2>
        <Link to="/ai-teacher" className="btn-primary text-base px-8 py-4 inline-flex">
          🚀 Start Learning Now
        </Link>
      </section>
    </div>
  )
}
