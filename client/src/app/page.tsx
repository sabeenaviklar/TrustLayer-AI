export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 rounded-full mb-6">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        TrustLayer Engine Ready
      </div>
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
        Eliminate AI Hallucinations.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-400">
        Source-grounded verification platform for enterprise language models.
      </p>
    </main>
  );
}
