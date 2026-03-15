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
        'flex-1 rounded-xl border bg-surface px-4 py-3 transition-all duration-300',
        isMaker
          ? 'border-maker-border bg-maker-dim'
          : 'border-checker-border bg-checker-dim',
        isActive && 'shadow-lg',
        isMaker && isActive && 'shadow-maker/20',
        !isMaker && isActive && 'shadow-checker/20'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {/* Active pulse indicator */}
        {isActive && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                isMaker ? 'bg-maker' : 'bg-checker'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                isMaker ? 'bg-maker' : 'bg-checker'
              )}
            />
          </span>
        )}
        <span
          className={cn(
            'text-sm font-bold tracking-widest',
            isMaker ? 'text-maker' : 'text-checker'
          )}
        >
          {role}
        </span>
      </div>

      <p className="text-xs text-slate-400 truncate">{modelName}</p>

      {isActive && (
        <div className="flex items-center gap-1.5 mt-2">
          <Spinner size="sm" className={isMaker ? 'text-maker' : 'text-checker'} />
          <span className="text-xs text-slate-400">Thinking...</span>
        </div>
      )}
    </div>
  );
}
