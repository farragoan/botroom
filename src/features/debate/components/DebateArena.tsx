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

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (turns.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns.length]);

  const isRunning = status === 'running';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  // Determine which agent is currently active (last turn's opposite)
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
    <div className="flex flex-col h-full">
      {/* Agent panels */}
      <div className="flex gap-3 px-4 pt-4 pb-3">
        <AgentPanel
          role="MAKER"
          modelName={makerModel}
          isActive={activeAgent === 'MAKER'}
        />
        <div className="flex items-center justify-center">
          <span className="text-slate-600 text-xs font-bold">VS</span>
        </div>
        <AgentPanel
          role="CHECKER"
          modelName={checkerModel}
          isActive={activeAgent === 'CHECKER'}
        />
      </div>

      {/* Topic banner */}
      {config?.topic && (
        <div className="mx-4 mb-3 rounded-lg bg-surface-raised border border-slate-800 px-4 py-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Topic</p>
          <p className="text-sm text-slate-300 line-clamp-2">{config.topic}</p>
        </div>
      )}

      {/* Cancel button */}
      {isRunning && (
        <div className="px-4 mb-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={cancelDebate}>
            ✕ Cancel
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {/* Initial loading state */}
        {isRunning && turns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" className="text-cyan-400" />
            <p className="text-slate-400 text-sm">Starting debate...</p>
          </div>
        )}

        {/* Turn cards */}
        <div className="flex flex-col gap-4">
          {turns.map((turn) => (
            <TurnCard key={turn.turnNumber} turn={turn} verbose={verbose} />
          ))}
        </div>

        {/* Synthesis */}
        {isComplete && synthesis && (
          <div className="mt-6">
            <SynthesisCard
              synthesis={synthesis}
              concludedNaturally={concludedNaturally}
              totalTurns={turns.length}
            />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mt-4 rounded-xl border border-red-800 bg-red-900/20 px-5 py-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-red-400">Something went wrong</p>
            {error && <p className="text-xs text-red-300/70">{error}</p>}
          </div>
        )}

        {/* Bottom sentinel for auto-scroll */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
