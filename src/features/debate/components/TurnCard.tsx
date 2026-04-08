import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Turn } from '@/types/debate';

interface TurnCardProps {
  turn: Turn;
  verbose?: boolean;
}

/** Messages longer than this get collapsed to 3 lines with a Read more button. */
export const READ_MORE_THRESHOLD = 280;

const cardVariants = {
  hidden: (agent: string) => ({
    opacity: 0,
    x: agent === 'MAKER' ? -24 : 24,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
    },
  },
};

export function TurnCard({ turn, verbose = false }: TurnCardProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { agent, response, turnNumber } = turn;
  const isMaker = agent === 'MAKER';
  const isLong = response.message.length > READ_MORE_THRESHOLD;

  return (
    <motion.div
      custom={agent}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'rounded-xl border bg-zinc-900 border-zinc-800 border-l-[3px] overflow-hidden shadow-card',
        isMaker ? 'border-l-maker' : 'border-l-checker',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/70">
        <span
          className={cn(
            'text-xs font-bold tracking-widest uppercase',
            isMaker ? 'text-maker' : 'text-checker',
          )}
        >
          {agent}
        </span>
        <Badge action={response.action} />
        <span className="ml-auto text-xs text-zinc-600 tabular-nums font-mono">
          T{turnNumber}
        </span>
      </div>

      {/* Message body — clamped to 3 lines when long */}
      <div className="px-4 pt-3 pb-2">
        <p
          data-testid="turn-message"
          className={cn(
            'text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap',
            isLong && !expanded && 'line-clamp-3',
          )}
        >
          {response.message}
        </p>

        {isLong && (
          <button
            data-testid="read-more-btn"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
          >
            {expanded ? '↑ Read less' : '↓ Read more'}
          </button>
        )}
      </div>

      {/* Conceded points */}
      {response.conceded_points.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg bg-amber-950/40 border border-amber-800/40 px-3 py-2">
          <p className="text-xs font-semibold text-amber-500 mb-1.5 uppercase tracking-wider">
            Conceded
          </p>
          <ul className="space-y-1">
            {response.conceded_points.map((point, i) => (
              <li key={i} className="text-xs text-amber-300/70 flex gap-2">
                <span className="text-amber-600 shrink-0">›</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Thinking (verbose) */}
      {verbose && response.thinking && (
        <div className="border-t border-zinc-800/70">
          <button
            onClick={() => setThinkingOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <svg
              className={cn(
                'w-3 h-3 transition-transform duration-200',
                thinkingOpen ? 'rotate-90' : 'rotate-0',
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
              <pre className="font-mono text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">
                {response.thinking}
              </pre>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
