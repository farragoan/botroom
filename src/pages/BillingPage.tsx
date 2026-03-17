// src/pages/BillingPage.tsx
import { useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { useUserStore } from '@/features/user/store/userStore';
import { useMe } from '@/features/user/hooks/useMe';
import { API_BASE } from '@/lib/constants';

const PACKS = [
  { key: 'small',    label: '₹49',  description: '~50 debates on free models' },
  { key: 'standard', label: '₹149', description: '~150 debates on free models' },
  { key: 'power',    label: '₹399', description: '~400 debates on free models' },
] as const;

export default function BillingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  useMe(); // keeps balance in sync
  const walletBalancePaise = useUserStore(s => s.walletBalancePaise);
  const setWalletBalance = useUserStore(s => s.setWalletBalance);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleTopUp(packKey: string) {
    setLoading(packKey);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pack: packKey }),
      });

      if (!res.ok) {
        console.error('Failed to create order:', await res.text());
        return;
      }

      const { order_id, amount } = await res.json() as { order_id: string; amount: number };

      const rzp = new Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
        amount,
        currency: 'INR',
        order_id,
        name: 'botroom',
        description: 'Wallet top-up',
        handler: () => {
          // Payment captured — webhook will update balance server-side
          // Poll /api/me after a short delay to reflect new balance
          setTimeout(async () => {
            const t = await getToken();
            const r = await fetch(`${API_BASE}/me`, {
              headers: { Authorization: `Bearer ${t}` },
            });
            if (r.ok) {
              const data = await r.json() as { wallet_balance_paise: number };
              setWalletBalance(data.wallet_balance_paise);
            }
          }, 2500);
        },
        prefill: {
          email: user?.primaryEmailAddress?.emailAddress,
        },
        theme: { color: '#6366f1' },
      });
      rzp.open();
    } finally {
      setLoading(null);
    }
  }

  const balanceInr = walletBalancePaise !== null
    ? (walletBalancePaise / 100).toFixed(2)
    : '...';
  const isNegative = (walletBalancePaise ?? 0) < 0;

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Wallet</h1>
      <p className={`text-3xl font-bold mb-8 ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
        ₹{balanceInr}
      </p>
      {isNegative && (
        <p className="text-red-400 text-sm mb-6">
          Your balance is negative. Top up to run more debates.
        </p>
      )}
      <h2 className="text-lg font-semibold text-zinc-300 mb-4">Top up</h2>
      <div className="grid gap-3">
        {PACKS.map(pack => (
          <button
            key={pack.key}
            onClick={() => handleTopUp(pack.key)}
            disabled={loading === pack.key}
            className="flex justify-between items-center bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg p-4 transition disabled:opacity-50"
          >
            <span className="font-semibold text-lg">{pack.label}</span>
            <span className="text-zinc-400 text-sm">{pack.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
