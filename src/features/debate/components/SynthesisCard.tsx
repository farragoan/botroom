interface SynthesisCardProps {
  synthesis: string;
  concludedNaturally: boolean;
  totalTurns: number;
}

export function SynthesisCard({ synthesis, concludedNaturally, totalTurns }: SynthesisCardProps) {
  return (
    <div className="animate-fade-in rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-card">
      {/* Accent top bar */}
      <div className="h-px bg-gradient-to-r from-maker via-checker to-maker opacity-70" />

      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <h3 className="text-base font-semibold gradient-text-brand tracking-wide">
            Synthesis
          </h3>

          {concludedNaturally ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Consensus Reached
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Max Turns Reached
            </span>
          )}

          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono text-zinc-500 bg-zinc-800 border border-zinc-700 tabular-nums">
            {totalTurns} {totalTurns === 1 ? 'turn' : 'turns'}
          </span>
        </div>

        {/* Synthesis text */}
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{synthesis}</p>
      </div>
    </div>
  );
}
