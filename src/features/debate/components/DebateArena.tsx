import { useEffect, useRef } from 'react';
import { useDebate } from '@/features/debate/hooks/useDebate';
import { TurnCard } from '@/features/debate/components/TurnCard';
import { AgentPanel } from '@/features/debate/components/AgentPanel';
import { SynthesisCard } from '@/features/debate/components/SynthesisCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export function DebateArena() {
  const { turns, synthesis, status, error, config, concludedNaturally, cancelDebate } =
    useDebate();

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feed to bottom when new turns arrive
  useEffect(() => {
    if (turns.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns.length]);

  const isRunning = status === 'running';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  const lastTurnAgent = turns[turns.length - 1]?.agent;
  const activeAgent = isRunning
    ? lastTurnAgent === 'MAKER'
      ? 'CHECKER'
      : 'MAKER'
    : null;

  const makerModel = config?.makerModel ?? '—';
  const checkerModel = config?.checkerModel ?? '—';
  const verbose = config?.verbose ?? false;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── STATIC HEADER (never scrolls) ─────────────────────── */}
      <div
        data-testid="debate-static-header"
        className="shrink-0 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur-sm"
      >
        {/* Agent panels */}
        <div className="flex gap-2 px-3 pt-3 pb-2 sm:px-4">
          <AgentPanel role="MAKER" modelName={makerModel} isActive={activeAgent === 'MAKER'} />
          <div className="flex items-center justify-center px-1">
            <span className="text-zinc-700 text-xs font-bold tracking-widest">VS</span>
          </div>
          <AgentPanel role="CHECKER" modelName={checkerModel} isActive={activeAgent === 'CHECKER'} />
        </div>

        {/* Topic + status bar */}
        <div className="flex items-center gap-2 px-3 pb-2 sm:px-4">
          {config?.topic && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-500 truncate">
                <span className="uppercase tracking-wider text-zinc-600 mr-1.5">Topic</span>
                {config.topic}
              </p>
            </div>
          )}

          {/* Turn counter + status */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {turns.length > 0 && (
              <span className="text-xs font-mono text-zinc-500 tabular-nums">
                {turns.length} {turns.length === 1 ? 'turn' : 'turns'}
              </span>
            )}
            {isRunning && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                <Spinner size="sm" className="text-maker" />
                running
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-800/50 px-2 py-0.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                complete
              </span>
            )}
            {isRunning && (
              <Button variant="ghost" size="sm" onClick={cancelDebate} className="h-6 px-2 text-xs">
                ✕ Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE FEED ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">

        {/* Initial loading */}
        {isRunning && turns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" className="text-maker" />
            <p className="text-zinc-500 text-sm">Starting debate…</p>
          </div>
        )}

        {/* Turn cards */}
        <div className="flex flex-col gap-3">
          {turns.map((turn) => (
            <TurnCard key={turn.turnNumber} turn={turn} verbose={verbose} />
          ))}
        </div>

        {/* Synthesis */}
        {isComplete && synthesis && (
          <div className="mt-5">
            <SynthesisCard
              synthesis={synthesis}
              concludedNaturally={concludedNaturally}
              totalTurns={turns.length}
            />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-5 py-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-red-400">Something went wrong</p>
            {error && <p className="text-xs text-red-400/60">{error}</p>}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
