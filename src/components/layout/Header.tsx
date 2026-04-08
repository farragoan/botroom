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
    <header className="sticky top-0 z-50 h-14 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="font-mono font-bold tracking-widest text-base gradient-text-brand select-none hover:opacity-80 transition-opacity"
          >
            BOTROOM
          </Link>
          <span className="hidden sm:block h-4 w-px bg-zinc-700" />
          <span className="hidden sm:block text-sm text-zinc-500 font-medium">AI Debate Arena</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/history" className="hidden sm:block text-xs text-zinc-500 hover:text-zinc-300 transition-colors">History</Link>
          {balanceDisplay !== null && (
            <Link
              to="/billing"
              className={`text-xs font-medium transition-colors ${isNegative ? 'text-red-400 hover:text-red-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {balanceDisplay}
            </Link>
          )}
          <UserButton />
        </div>
      </div>
    </header>
  );
}
