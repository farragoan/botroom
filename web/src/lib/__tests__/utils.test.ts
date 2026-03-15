import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, parseSSEBuffer, formatTurnLabel, sleep } from '@/lib/utils';

describe('cn()', () => {
  it('combines multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, undefined, null)).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });
});

describe('parseSSEBuffer()', () => {
  it('parses a single complete event', () => {
    const buffer = 'event: turn\ndata: {"turnNumber":1}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('turn');
    expect(parsed[0].data).toEqual({ turnNumber: 1 });
    expect(remaining).toBe('');
  });

  it('parses multiple events', () => {
    const buffer =
      'event: turn\ndata: {"turnNumber":1}\n\nevent: synthesis\ndata: {"synthesis":"done"}\n\n';
    const { parsed, remaining } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe('turn');
    expect(parsed[1].type).toBe('synthesis');
    expect(remaining).toBe('');
  });

  it('preserves incomplete trailing chunk as remaining', () => {
    const buffer = 'event: turn\ndata: {"turnNumber":1}\n\nevent: turn\ndata: {"turnNumb';
    const { parsed, remaining } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(remaining).toBe('event: turn\ndata: {"turnNumb');
  });

  it('returns empty parsed and full string for partial buffer with no double newline', () => {
    const buffer = 'event: turn\ndata: {"turnNumber":1}';
    const { parsed, remaining } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(0);
    expect(remaining).toBe(buffer);
  });

  it('skips events with no data line', () => {
    const buffer = 'event: ping\n\n';
    const { parsed } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(0);
  });

  it('falls back to raw string for malformed JSON in data', () => {
    const buffer = 'event: turn\ndata: not-json\n\n';
    const { parsed } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].data).toBe('not-json');
  });

  it('defaults event type to "message" when no event line', () => {
    const buffer = 'data: {"foo":"bar"}\n\n';
    const { parsed } = parseSSEBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('message');
  });
});

describe('formatTurnLabel()', () => {
  it('formats MAKER turn label', () => {
    expect(formatTurnLabel(1, 'MAKER')).toBe('Turn 1 · MAKER');
  });

  it('formats CHECKER turn label', () => {
    expect(formatTurnLabel(3, 'CHECKER')).toBe('Turn 3 · CHECKER');
  });

  it('handles double-digit turn numbers', () => {
    expect(formatTurnLabel(10, 'MAKER')).toBe('Turn 10 · MAKER');
  });
});

describe('sleep()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the given milliseconds', async () => {
    let resolved = false;
    const promise = sleep(500).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    vi.advanceTimersByTime(499);
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('returns a Promise', () => {
    const result = sleep(0);
    expect(result).toBeInstanceOf(Promise);
    vi.runAllTimers();
  });
});
