// src/features/user/hooks/useMe.ts
import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { useUserStore } from '@/features/user/store/userStore';
import { API_BASE } from '@/lib/constants';

export function useMe() {
  const { getToken, isSignedIn } = useAuth();
  const { walletBalancePaise, setWalletBalance } = useUserStore();

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { wallet_balance_paise: number };
        setWalletBalance(data.wallet_balance_paise);
      }
    })();
  }, [isSignedIn, getToken, setWalletBalance]);

  return { walletBalancePaise };
}
