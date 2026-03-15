import { describe, it, expect, beforeEach } from 'vitest';
import { useDebateStore } from '@/features/debate/store/debateStore';
import type { DebateConfig, Turn } from '@/types/debate';

const mockConfig: DebateConfig = {
  topic: 'Is TypeScript better than JavaScript?',
  makerModel: 'llama-70b',
  checkerModel: 'llama4-maverick',
  maxTurns: 8,
  verbose: false,
};

const mockTurn: Turn = {
  turnNumber: 1,
  agent: 'MAKER',
  response: {
    thinking: 'Some reasoning',
    message: 'My argument',
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  },
};

const mockTurn2: Turn = {
  turnNumber: 2,
  agent: 'CHECKER',
  response: {
    thinking: 'Counter reasoning',
    message: 'My counter-argument',
    action: 'CONTINUE',
    conceded_points: ['Point 1'],
    conclusion_summary: null,
  },
};

describe('debateStore', () => {
  beforeEach(() => {
    useDebateStore.getState().reset();
  });

  describe('initial state', () => {
    it('has null config', () => {
      expect(useDebateStore.getState().config).toBeNull();
    });

    it('has empty turns array', () => {
      expect(useDebateStore.getState().turns).toEqual([]);
    });

    it('has null synthesis', () => {
      expect(useDebateStore.getState().synthesis).toBeNull();
    });

    it('has idle status', () => {
      expect(useDebateStore.getState().status).toBe('idle');
    });

    it('has null error', () => {
      expect(useDebateStore.getState().error).toBeNull();
    });

    it('has concludedNaturally as false', () => {
      expect(useDebateStore.getState().concludedNaturally).toBe(false);
    });
  });

  describe('setConfig()', () => {
    it('sets the config', () => {
      useDebateStore.getState().setConfig(mockConfig);
      expect(useDebateStore.getState().config).toEqual(mockConfig);
    });

    it('updates config when called again', () => {
      useDebateStore.getState().setConfig(mockConfig);
      const newConfig: DebateConfig = { ...mockConfig, topic: 'New topic' };
      useDebateStore.getState().setConfig(newConfig);
      expect(useDebateStore.getState().config?.topic).toBe('New topic');
    });
  });

  describe('setStatus()', () => {
    it('sets status to running', () => {
      useDebateStore.getState().setStatus('running');
      expect(useDebateStore.getState().status).toBe('running');
    });

    it('sets status to complete', () => {
      useDebateStore.getState().setStatus('complete');
      expect(useDebateStore.getState().status).toBe('complete');
    });

    it('sets status to error', () => {
      useDebateStore.getState().setStatus('error');
      expect(useDebateStore.getState().status).toBe('error');
    });

    it('sets status back to idle', () => {
      useDebateStore.getState().setStatus('running');
      useDebateStore.getState().setStatus('idle');
      expect(useDebateStore.getState().status).toBe('idle');
    });
  });

  describe('addTurn()', () => {
    it('appends a turn to the turns array', () => {
      useDebateStore.getState().addTurn(mockTurn);
      expect(useDebateStore.getState().turns).toHaveLength(1);
      expect(useDebateStore.getState().turns[0]).toEqual(mockTurn);
    });

    it('appends multiple turns without replacing', () => {
      useDebateStore.getState().addTurn(mockTurn);
      useDebateStore.getState().addTurn(mockTurn2);
      const turns = useDebateStore.getState().turns;
      expect(turns).toHaveLength(2);
      expect(turns[0]).toEqual(mockTurn);
      expect(turns[1]).toEqual(mockTurn2);
    });

    it('preserves turn order', () => {
      useDebateStore.getState().addTurn(mockTurn);
      useDebateStore.getState().addTurn(mockTurn2);
      const turns = useDebateStore.getState().turns;
      expect(turns[0].turnNumber).toBe(1);
      expect(turns[1].turnNumber).toBe(2);
    });
  });

  describe('setSynthesis()', () => {
    it('sets the synthesis string', () => {
      useDebateStore.getState().setSynthesis('Final synthesis text');
      expect(useDebateStore.getState().synthesis).toBe('Final synthesis text');
    });

    it('overwrites previous synthesis', () => {
      useDebateStore.getState().setSynthesis('First synthesis');
      useDebateStore.getState().setSynthesis('Updated synthesis');
      expect(useDebateStore.getState().synthesis).toBe('Updated synthesis');
    });
  });

  describe('setConcludedNaturally()', () => {
    it('sets concludedNaturally to true', () => {
      useDebateStore.getState().setConcludedNaturally(true);
      expect(useDebateStore.getState().concludedNaturally).toBe(true);
    });

    it('sets concludedNaturally to false', () => {
      useDebateStore.getState().setConcludedNaturally(true);
      useDebateStore.getState().setConcludedNaturally(false);
      expect(useDebateStore.getState().concludedNaturally).toBe(false);
    });
  });

  describe('setError()', () => {
    it('sets the error message', () => {
      useDebateStore.getState().setError('Something went wrong');
      expect(useDebateStore.getState().error).toBe('Something went wrong');
    });

    it('overwrites previous error', () => {
      useDebateStore.getState().setError('First error');
      useDebateStore.getState().setError('Second error');
      expect(useDebateStore.getState().error).toBe('Second error');
    });
  });

  describe('reset()', () => {
    it('resets all state to initial values', () => {
      // Populate state
      useDebateStore.getState().setConfig(mockConfig);
      useDebateStore.getState().setStatus('running');
      useDebateStore.getState().addTurn(mockTurn);
      useDebateStore.getState().setSynthesis('Some synthesis');
      useDebateStore.getState().setConcludedNaturally(true);
      useDebateStore.getState().setError('Some error');

      // Reset
      useDebateStore.getState().reset();

      const state = useDebateStore.getState();
      expect(state.config).toBeNull();
      expect(state.turns).toEqual([]);
      expect(state.synthesis).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.concludedNaturally).toBe(false);
    });

    it('allows fresh use after reset', () => {
      useDebateStore.getState().setConfig(mockConfig);
      useDebateStore.getState().addTurn(mockTurn);
      useDebateStore.getState().reset();

      useDebateStore.getState().setConfig({ ...mockConfig, topic: 'New topic' });
      useDebateStore.getState().addTurn(mockTurn2);

      const state = useDebateStore.getState();
      expect(state.config?.topic).toBe('New topic');
      expect(state.turns).toHaveLength(1);
      expect(state.turns[0].turnNumber).toBe(2);
    });
  });
});
