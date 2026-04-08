import { render, screen } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { DebateArena } from '@/features/debate/components/DebateArena';
import { useDebate } from '@/features/debate/hooks/useDebate';

vi.mock('@/features/debate/hooks/useDebate');

const mockUseDebate = vi.mocked(useDebate);

const baseDebateState = {
  turns: [],
  synthesis: null,
  status: 'running' as const,
  error: null,
  config: {
    topic: 'Should AI be regulated?',
    makerModel: 'compound-beta-mini',
    checkerModel: 'llama-4-maverick-17b-128e-instruct',
    maxTurns: 8,
    verbose: false,
  },
  concludedNaturally: false,
  startDebate: vi.fn(),
  cancelDebate: vi.fn(),
};

beforeEach(() => {
  mockUseDebate.mockReturnValue(baseDebateState);
});

describe('DebateArena', () => {
  // ── Static header ────────────────────────────────────────────
  it('renders the static header element', () => {
    render(<DebateArena />);
    expect(screen.getByTestId('debate-static-header')).toBeInTheDocument();
  });

  it('static header contains both agent role labels', () => {
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.textContent).toMatch(/MAKER/);
    expect(header.textContent).toMatch(/CHECKER/);
  });

  it('static header shows the debate topic', () => {
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.textContent).toContain('Should AI be regulated?');
  });

  it('static header shows turn count when turns exist', () => {
    mockUseDebate.mockReturnValue({
      ...baseDebateState,
      turns: [
        {
          turnNumber: 1,
          agent: 'MAKER',
          response: {
            thinking: '',
            message: 'Opening argument.',
            action: 'CONTINUE',
            conceded_points: [],
            conclusion_summary: null,
          },
        },
      ],
    });
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.textContent).toMatch(/1\s*turn/);
  });

  it('shows running status indicator while debate is active', () => {
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.textContent).toMatch(/running/i);
  });

  it('shows complete indicator when debate is done', () => {
    mockUseDebate.mockReturnValue({
      ...baseDebateState,
      status: 'complete',
      synthesis: 'A balanced view.',
    });
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.textContent).toMatch(/complete/i);
  });

  it('static header has shrink-0 to prevent it from scrolling away', () => {
    render(<DebateArena />);
    const header = screen.getByTestId('debate-static-header');
    expect(header.className).toMatch(/shrink-0/);
  });

  // ── Scrollable feed ──────────────────────────────────────────
  it('renders a scrollable feed container below the header', () => {
    const { container } = render(<DebateArena />);
    // The outer wrapper is a flex-col; the second child (after header) is the scrollable area
    const outerDiv = container.firstChild as HTMLElement;
    const feedDiv = outerDiv.children[1] as HTMLElement;
    expect(feedDiv.className).toMatch(/overflow-y-auto/);
    expect(feedDiv.className).toMatch(/flex-1/);
  });

  // ── Synthesis / error ────────────────────────────────────────
  it('shows synthesis card when debate is complete', () => {
    mockUseDebate.mockReturnValue({
      ...baseDebateState,
      status: 'complete',
      synthesis: 'Final synthesis text here.',
    });
    render(<DebateArena />);
    expect(screen.getByText('Final synthesis text here.')).toBeInTheDocument();
  });

  it('shows error message on error status', () => {
    mockUseDebate.mockReturnValue({
      ...baseDebateState,
      status: 'error',
      error: 'API call failed.',
    });
    render(<DebateArena />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('API call failed.')).toBeInTheDocument();
  });
});
