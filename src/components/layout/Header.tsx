import { UserButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import { useUserStore } from '@/features/user/store/userStore';

export function Header() {
  const walletBalancePaise = useUserStore(s => s.walletBalancePaise);
  const balanceDisplay = walletBalancePaise !== null
    ? `₹${(walletBalancePaise / 100).toFixed(2)}`
    : null;
  const isNegative = (walletBalancePaise ?? 0) < 0;

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md h-14 flex flex-col justify-end">
      <div className="flex items-center justify-between px-6 pb-3">
        <span
          className="text-xl font-bold tracking-widest bg-gradient-to-r from-maker to-checker bg-clip-text text-transparent select-none"
        >
          BOTROOM
        </span>
        <span className="text-sm text-slate-400 tracking-wide">AI Debate Arena</span>
        <div className="flex items-center gap-4">
          <Link to="/history" className="text-sm text-zinc-400 hover:text-white transition-colors">History</Link>
          {balanceDisplay !== null && (
            <Link
              to="/billing"
              className={`text-sm font-medium transition-colors ${isNegative ? 'text-red-400 hover:text-red-300' : 'text-zinc-400 hover:text-white'}`}
            >
              {balanceDisplay}
            </Link>
          )}
          <UserButton />
        </div>
      </div>
      {/* Thin gradient divider line */}
      <div className="h-px bg-gradient-to-r from-maker via-checker to-maker opacity-60" />
    </header>
  );
}
