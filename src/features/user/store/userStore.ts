// src/features/user/store/userStore.ts
import { create } from 'zustand';

interface UserState {
  walletBalancePaise: number | null;
  setWalletBalance: (paise: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  walletBalancePaise: null,
  setWalletBalance: (paise) => set({ walletBalancePaise: paise }),
}));
