import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import AITeacher from './pages/AITeacher.jsx'
import Quiz from './pages/Quiz.jsx'
import StudyPlanner from './pages/StudyPlanner.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ai-teacher" element={<AITeacher />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/study-planner" element={<StudyPlanner />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
