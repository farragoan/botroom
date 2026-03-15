import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Turn } from '@/types/debate';

interface TurnCardProps {
  turn: Turn;
  verbose?: boolean;
}

const cardVariants = {
  hidden: (agent: string) => ({
    opacity: 0,
    x: agent === 'MAKER' ? -40 : 40,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 25,
    },
  },
};

export function TurnCard({ turn, verbose = false }: TurnCardProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const { agent, response, turnNumber } = turn;
  const isMaker = agent === 'MAKER';

  return (
    <motion.div
      custom={agent}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'rounded-xl border bg-surface border-slate-800 border-l-4 overflow-hidden',
        isMaker ? 'border-l-maker' : 'border-l-checker'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60">
        <span
          className={cn(
            'text-sm font-bold tracking-wider',
            isMaker ? 'text-maker' : 'text-checker'
          )}
        >
          {agent}
        </span>
        <Badge action={response.action} />
        <span className="ml-auto text-xs text-slate-500">Turn {turnNumber}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{response.message}</p>
      </div>

      {/* Conceded points */}
      {response.conceded_points.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg bg-amber-900/20 border border-amber-800/50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-400 mb-1.5 uppercase tracking-wider">
            Conceded Points
          </p>
          <ul className="space-y-1">
            {response.conceded_points.map((point, i) => (
              <li key={i} className="text-sm text-amber-300/80 flex gap-2">
                <span className="text-amber-500 shrink-0">›</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Thinking (verbose) */}
      {verbose && response.thinking && (
        <div className="border-t border-slate-800/60">
          <button
            onClick={() => setThinkingOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <svg
              className={cn(
                'w-3 h-3 transition-transform duration-200',
                thinkingOpen ? 'rotate-90' : 'rotate-0'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Thinking
          </button>
          {thinkingOpen && (
            <div className="px-4 pb-3">
              <pre className="font-mono text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
                {response.thinking}
              </pre>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
