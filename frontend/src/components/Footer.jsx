export default function Footer() {
  return (
    <footer id="contact" className="border-t border-white/10 mt-24 bg-space-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
                E
              </span>
              <span className="font-bold gradient-text">EduVerse AI Lite</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              A futuristic AI learning companion that explains topics, builds quizzes, and plans
              your study schedule — all in one place.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="/" className="hover:text-indigo-300 transition-colors">Home</a></li>
              <li><a href="/ai-teacher" className="hover:text-indigo-300 transition-colors">AI Teacher</a></li>
              <li><a href="/quiz" className="hover:text-indigo-300 transition-colors">AI Quiz</a></li>
              <li><a href="/study-planner" className="hover:text-indigo-300 transition-colors">Study Planner</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>📧 hello@eduverse.ai</li>
              <li>🌐 eduverse.ai</li>
              <li>📍 Built with FastAPI + React</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} EduVerse AI Lite. Built for learners everywhere.
        </div>
      </div>
    </footer>
  )
}
