import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "AI Research Lead \u00b7 Scale AI",
    text: "BotRoom completely changed how I stress-test arguments. Watching two AIs punch holes in each other\u2019s logic surfaced weaknesses in my own reasoning I never would have caught.",
    avatar: "SC",
  },
  {
    name: "Marcus Rivera",
    role: "Senior Product Manager \u00b7 Notion",
    text: "I use BotRoom to pressure-test product decisions before presenting to stakeholders. It\u2019s like having a devil\u2019s advocate that never gets tired and never holds back.",
    avatar: "MR",
  },
  {
    name: "Priya Sharma",
    role: "Philosophy PhD Candidate \u00b7 MIT",
    text: "The quality of argumentation is genuinely impressive. These agents don\u2019t just trade assertions \u2014 they find actual logical vulnerabilities and exploit them.",
    avatar: "PS",
  },
  {
    name: "James O'Brien",
    role: "Debate Coach \u00b7 Harvard",
    text: "My students use this to drill counter-argument skills. Nothing sharpens your thinking like watching two relentless AIs dismantle every claim you make.",
    avatar: "JO",
  },
  {
    name: "Yuki Tanaka",
    role: "Strategy Consultant \u00b7 McKinsey",
    text: "BotRoom is my secret weapon for due diligence. I throw a thesis at it and see what survives. If the AIs can\u2019t kill it, the thesis is probably solid.",
    avatar: "YT",
  },
  {
    name: "Alex Mercer",
    role: "Founder \u00b7 Argos Labs",
    text: "We integrated BotRoom into our research pipeline. The synthesis at the end of each debate is surprisingly nuanced \u2014 it doesn\u2019t just pick a winner, it builds something new.",
    avatar: "AM",
  },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Real-time Streaming',
    desc: 'Watch arguments form token by token. Every turn streams live as the models reason through their positions in real time.',
  },
  {
    icon: '🧠',
    title: 'Dual-Agent Architecture',
    desc: 'MAKER builds the case. CHECKER hunts for flaws. They iterate until one concedes or both converge on a shared truth.',
  },
  {
    icon: '📊',
    title: 'Structured Synthesis',
    desc: 'Every debate ends with a synthesis — the strongest surviving arguments distilled into a clear, concise conclusion.',
  },
];

const SECTIONS = ['Hero', 'How It Works', 'Testimonials', 'About', 'Get Started'];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 48 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Avatar({ initials, gradient }: { initials: string; gradient?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
        gradient
          ? 'bg-gradient-to-br from-cyan-500 to-fuchsia-500'
          : 'bg-zinc-800 border border-zinc-700'
      )}
    >
      {initials}
    </div>
  );
}

function TestimonialCard({ name, role, text, avatar }: (typeof TESTIMONIALS)[number]) {
  return (
    <motion.div
      variants={cardVariant}
      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm"
    >
      <p className="text-sm leading-relaxed text-zinc-300">"{text}"</p>
      <div className="mt-auto flex items-center gap-3 border-t border-zinc-800 pt-3">
        <Avatar initials={avatar} />
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-zinc-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: (typeof FEATURES)[number]) {
  return (
    <motion.div
      variants={cardVariant}
      className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7 backdrop-blur-sm transition-colors hover:border-zinc-700"
    >
      {/* gradient shimmer on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-fuchsia-500/5 blur-3xl" />
      </div>
      <span className="mb-4 block text-3xl">{icon}</span>
      <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{desc}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Dot navigation
// ---------------------------------------------------------------------------

function DotNav({
  activeSection,
  onDotClick,
}: {
  activeSection: number;
  onDotClick: (i: number) => void;
}) {
  return (
    <div className="fixed right-6 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3">
      {SECTIONS.map((label, i) => (
        <button
          key={label}
          onClick={() => onDotClick(i)}
          title={label}
          className="group flex items-center justify-end gap-2"
        >
          <span className="hidden text-xs text-zinc-500 transition-opacity group-hover:opacity-100 opacity-0 sm:block">
            {label}
          </span>
          <span
            className={cn(
              'block rounded-full transition-all duration-300',
              i === activeSection
                ? 'h-3 w-3 bg-gradient-to-br from-cyan-400 to-fuchsia-400'
                : 'h-2 w-2 bg-zinc-700 group-hover:bg-zinc-500'
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  // Track which section is in view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const height = container.clientHeight;
      const idx = Math.round(scrollTop / height);
      setActiveSection(Math.min(idx, SECTIONS.length - 1));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToSection(i: number) {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: i * container.clientHeight, behavior: 'smooth' });
  }

  return (
    <div className="relative h-screen w-full bg-[#09090b] text-slate-50">
      {/* ----------------------------------------------------------------- */}
      {/* Top nav bar                                                        */}
      {/* ----------------------------------------------------------------- */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-zinc-800/60 bg-[#09090b]/80 px-5 backdrop-blur-md sm:px-8">
        <button
          onClick={() => scrollToSection(0)}
          className="font-mono text-base font-bold tracking-widest bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent select-none"
        >
          BOTROOM
        </button>
        <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
          {SECTIONS.slice(1, -1).map((s, i) => (
            <button
              key={s}
              onClick={() => scrollToSection(i + 1)}
              className="transition-colors hover:text-white"
            >
              {s}
            </button>
          ))}
        </nav>
        <button
          onClick={() => navigate('/arena')}
          className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-80"
        >
          Launch Arena →
        </button>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Dot navigation                                                     */}
      {/* ----------------------------------------------------------------- */}
      <DotNav activeSection={activeSection} onDotClick={scrollToSection} />

      {/* ----------------------------------------------------------------- */}
      {/* Scroll container                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* =============================================================== */}
        {/* SECTION 1 — Hero                                                */}
        {/* =============================================================== */}
        <section
          ref={(el) => { sectionRefs.current[0] = el; }}
          className="relative flex h-screen snap-start flex-col items-center justify-center px-6 text-center"
        >
          {/* Background grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          {/* Glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[100px]" />
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="relative flex flex-col items-center gap-6 max-w-3xl"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI-Powered Debate · Powered by Groq
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-6xl font-black tracking-tighter sm:text-8xl"
            >
              <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                Two AI minds.
              </span>
              <br />
              <span className="text-white">One truth.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-xl text-lg leading-relaxed text-zinc-400"
            >
              BotRoom pits two large language models against each other on any
              topic. Watch them argue, concede, and converge — live.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/arena')}
                className="rounded-xl bg-white px-7 py-3 text-sm font-bold text-black shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
              >
                Launch Arena →
              </button>
              <button
                onClick={() => scrollToSection(1)}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-7 py-3 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:text-white"
              >
                How it works
              </button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex items-center gap-6 pt-4 text-xs text-zinc-600"
            >
              <span>✓ Free to try</span>
              <span>✓ Real-time streaming</span>
              <span>✓ Multi-model support</span>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="text-zinc-700 text-xl"
            >
              ↓
            </motion.div>
          </motion.div>
        </section>

        {/* =============================================================== */}
        {/* SECTION 2 — How it works                                        */}
        {/* =============================================================== */}
        <section
          ref={(el) => { sectionRefs.current[1] = el; }}
          className="flex h-screen snap-start flex-col items-center justify-center px-6 sm:px-12"
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="w-full max-w-5xl"
          >
            <motion.div variants={fadeUp} className="mb-12 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
                The Engine
              </p>
              <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                How it works
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              className="grid gap-5 sm:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </motion.div>

            {/* Flow diagram */}
            <motion.div
              variants={fadeUp}
              className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-500"
            >
              <span className="rounded-lg border border-cyan-900/50 bg-cyan-950/30 px-3 py-1.5 text-cyan-400 font-mono text-xs">
                MAKER
              </span>
              <span className="text-zinc-700">argues →</span>
              <span className="rounded-lg border border-fuchsia-900/50 bg-fuchsia-950/30 px-3 py-1.5 text-fuchsia-400 font-mono text-xs">
                CHECKER
              </span>
              <span className="text-zinc-700">rebuts →</span>
              <span className="text-zinc-700">repeat →</span>
              <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-300 font-mono text-xs">
                SYNTHESIS
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* =============================================================== */}
        {/* SECTION 3 — Testimonials                                        */}
        {/* =============================================================== */}
        <section
          ref={(el) => { sectionRefs.current[2] = el; }}
          className="flex h-screen snap-start flex-col items-center justify-center px-6 sm:px-12"
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="w-full max-w-5xl"
          >
            <motion.div variants={fadeUp} className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
                Social Proof
              </p>
              <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                What people say
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {TESTIMONIALS.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* =============================================================== */}
        {/* SECTION 4 — About                                               */}
        {/* =============================================================== */}
        <section
          ref={(el) => { sectionRefs.current[3] = el; }}
          className="flex h-screen snap-start flex-col items-center justify-center px-6 sm:px-12"
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="w-full max-w-4xl"
          >
            <motion.div variants={fadeUp} className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
                The Builder
              </p>
              <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                About us
              </h2>
            </motion.div>

            <motion.div
              variants={cardVariant}
              className="flex flex-col items-center gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 backdrop-blur-sm sm:flex-row sm:items-start sm:gap-10"
            >
              {/* Photo — replace src with your actual photo URL */}
              <div className="flex-shrink-0">
                <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-zinc-700 sm:h-44 sm:w-44">
                  {/*
                    Replace the div below with:
                    <img src="/your-photo.jpg" alt="Dhruv Nagpal" className="h-full w-full object-cover" />
                  */}
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-900/60 via-zinc-900 to-fuchsia-900/60">
                    <span className="text-5xl font-black bg-gradient-to-br from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent select-none">
                      DN
                    </span>
                  </div>
                  {/* Gradient border shimmer */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
                </div>
              </div>

              <div className="flex flex-col gap-3 text-center sm:text-left">
                <div>
                  <h3 className="text-2xl font-black text-white">Dhruv Nagpal</h3>
                  <p className="text-sm text-zinc-400">
                    Frontend Engineer · Angel One &nbsp;·&nbsp; BITS Pilani
                  </p>
                </div>
                <p className="max-w-lg text-sm leading-relaxed text-zinc-400">
                  Building scalable products at Angel One, where I lead frontend
                  initiatives and optimize performance for a high-traffic trading
                  platform serving millions of users. Previously at Amazon. CS
                  graduate from BITS Pilani, Goa.
                </p>
                <p className="max-w-lg text-sm leading-relaxed text-zinc-400">
                  BotRoom started as a curiosity experiment — what happens when
                  two LLMs with opposing mandates argue until they genuinely
                  agree? Turns out, the debates are surprisingly sharp.
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                  {[
                    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dhruv-nagpal/' },
                    { label: 'Personal Site', href: 'https://dhruvnagpal.in' },
                    { label: 'Email', href: 'mailto:hello@dhruvnagpal.in' },
                  ].map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      {label} ↗
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* =============================================================== */}
        {/* SECTION 5 — CTA + Footer                                        */}
        {/* =============================================================== */}
        <section
          ref={(el) => { sectionRefs.current[4] = el; }}
          className="relative flex h-screen snap-start flex-col items-center justify-center px-6 text-center"
        >
          {/* Glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500/8 to-fuchsia-500/8 blur-[120px]" />
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            className="relative flex flex-col items-center gap-6 max-w-2xl"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live now · Powered by Groq
              </span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="text-5xl font-black tracking-tight sm:text-7xl"
            >
              <span className="text-white">Ready to watch</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
                AIs argue?
              </span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-zinc-400 text-base max-w-md">
              Pick a topic, choose your models, and launch a debate. It takes
              ten seconds to start.
            </motion.p>

            <motion.button
              variants={fadeUp}
              onClick={() => navigate('/arena')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-10 py-4 text-base font-bold text-white shadow-lg shadow-cyan-500/20 transition-shadow hover:shadow-cyan-500/30"
            >
              Open the Arena →
            </motion.button>

            <motion.p variants={fadeUp} className="text-xs text-zinc-600">
              Debates run on Groq infrastructure. Models may vary.
            </motion.p>
          </motion.div>

          {/* Footer copyright */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800/60 py-4 px-6">
            <p className="text-center text-xs text-zinc-600">
              © {new Date().getFullYear()} BotRoom · Built by Dhruv Nagpal · All rights reserved
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
