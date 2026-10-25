import { Link } from 'react-router-dom';

const STEPS = [
  {
    n: '01',
    title: 'Paste your case',
    desc: 'Drop in the case you are working on: situation, question, numbers. Your text goes to the hosted model for this session only, and nothing else is added to it.',
  },
  {
    n: '02',
    title: 'Analyst vs Reviewer',
    desc: 'One agent structures the problem and commits to a recommendation. The other behaves like an engagement partner and attacks assumptions and arithmetic.',
  },
  {
    n: '03',
    title: 'Get the write-up',
    desc: 'You receive a short summary: problem statement, key analysis, recommendation, risks and next steps, with assumptions labelled.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <span className="font-mono text-base font-bold tracking-widest gradient-text-brand select-none">
          BOTROOM
        </span>
        <Link to="/arena" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          Sign in
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Work through a business case
            <span className="gradient-text-brand"> with two AI minds.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Botroom pairs an analyst with a reviewer to structure your case, pressure-test the
            numbers and land on a defensible recommendation.
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              to="/arena"
              className="rounded-xl bg-zinc-50 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:ring-2"
            >
              Start a case
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <span className="font-mono text-xs text-zinc-500">{s.n}</span>
              <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-800/60">
        <div className="mx-auto max-w-5xl px-5 py-8 text-xs leading-relaxed text-zinc-600">
          <p>
            Botroom does not include, host or train on any casebook content. You supply the case
            text; only use material you have the right to use. AI output can be wrong: check the
            numbers before you rely on them.
          </p>
          <p className="mt-2">
            Built by{' '}
            <a href="https://dhruvnagpal.in" className="text-zinc-400 hover:text-zinc-200">
              Dhruv Nagpal
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
