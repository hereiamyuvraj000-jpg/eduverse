export default function Loader({ label = 'Thinking...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 border-r-purple-400 animate-spin"></div>
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 animate-glow-pulse"></div>
      </div>
      <p className="text-slate-300 font-medium animate-pulse">{label}</p>
    </div>
  )
}
