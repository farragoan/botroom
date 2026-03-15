import { create } from 'zustand';
import type { DebateConfig, DebateState, DebateStatus, Turn } from '@/types/debate';

interface DebateStore extends DebateState {
  setConfig(config: DebateConfig): void;
  setStatus(status: DebateStatus): void;
  addTurn(turn: Turn): void;
  setSynthesis(synthesis: string): void;
  setConcludedNaturally(value: boolean): void;
  setError(error: string): void;
  reset(): void;
}

const initialState: DebateState = {
  config: null,
  turns: [],
  synthesis: null,
  status: 'idle',
  error: null,
  concludedNaturally: false,
};

export const useDebateStore = create<DebateStore>((set) => ({
  ...initialState,

  setConfig: (config) => set({ config }),

  setStatus: (status) => set({ status }),

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  setSynthesis: (synthesis) => set({ synthesis }),

  setConcludedNaturally: (value) => set({ concludedNaturally: value }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState }),
}));
