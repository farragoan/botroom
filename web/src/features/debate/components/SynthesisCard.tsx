
interface SynthesisCardProps {
  synthesis: string;
  concludedNaturally: boolean;
  totalTurns: number;
}

export function SynthesisCard({ synthesis, concludedNaturally, totalTurns }: SynthesisCardProps) {
  return (
    <div className="animate-fade-in rounded-xl bg-surface border border-slate-700 overflow-hidden relative">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500" />

      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent tracking-wide">
            ✦ Synthesis
          </h3>

          {concludedNaturally ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Consensus Reached
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Max Turns Reached
            </span>
          )}

          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
            {totalTurns} {totalTurns === 1 ? 'turn' : 'turns'}
          </span>
        </div>

        {/* Synthesis text */}
        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{synthesis}</p>
      </div>

      {/* Gradient bottom border */}
      <div className="h-px bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 opacity-40" />
    </div>
  );
}
