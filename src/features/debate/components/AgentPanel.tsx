import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { AgentRole } from '@/types/debate';

interface AgentPanelProps {
  role: AgentRole;
  modelName: string;
  isActive: boolean;
}

export function AgentPanel({ role, modelName, isActive }: AgentPanelProps) {
  const isMaker = role === 'MAKER';

  return (
    <div
      className={cn(
        'flex-1 min-w-0 rounded-xl border px-3 py-2.5 transition-all duration-300',
        isMaker
          ? 'border-maker-border bg-maker-dim'
          : 'border-checker-border bg-checker-dim',
        isActive && (isMaker ? 'shadow-glow-maker' : 'shadow-glow-checker'),
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {isActive && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                isMaker ? 'bg-maker' : 'bg-checker',
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-1.5 w-1.5',
                isMaker ? 'bg-maker' : 'bg-checker',
              )}
            />
          </span>
        )}
        <span
          className={cn(
            'text-xs font-bold tracking-widest uppercase',
            isMaker ? 'text-maker' : 'text-checker',
          )}
        >
          {role}
        </span>
      </div>

      <p className="text-[11px] text-zinc-500 truncate leading-snug">{modelName}</p>

      {isActive && (
        <div className="flex items-center gap-1 mt-1.5">
          <Spinner size="sm" className={isMaker ? 'text-maker' : 'text-checker'} />
          <span className="text-[11px] text-zinc-500">Thinking…</span>
        </div>
      )}
    </div>
  );
}
