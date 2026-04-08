import { render, screen, fireEvent } from '@testing-library/react';
import { TurnCard, READ_MORE_THRESHOLD } from '@/features/debate/components/TurnCard';
import type { Turn } from '@/types/debate';

const makerTurn: Turn = {
  turnNumber: 1,
  agent: 'MAKER',
  response: {
    thinking: 'I am thinking deeply about this topic.',
    message: 'AI should indeed be regulated to ensure safety.',
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  },
};

const checkerTurn: Turn = {
  turnNumber: 2,
  agent: 'CHECKER',
  response: {
    thinking: 'Let me consider the counter argument.',
    message: 'Regulation could stifle innovation.',
    action: 'CONCEDE',
    conceded_points: ['Safety is important', 'Oversight has value'],
    conclusion_summary: null,
  },
};

const concludeTurn: Turn = {
  turnNumber: 3,
  agent: 'MAKER',
  response: {
    thinking: 'We have reached agreement.',
    message: 'I believe we have found common ground.',
    action: 'CONCLUDE',
    conceded_points: [],
    conclusion_summary: 'Both sides agree on balanced regulation.',
  },
};

/** Generates a message string longer than READ_MORE_THRESHOLD */
function longMessage(extra = 0): string {
  return 'A'.repeat(READ_MORE_THRESHOLD + 1 + extra);
}

const longTurn: Turn = {
  turnNumber: 4,
  agent: 'MAKER',
  response: {
    thinking: '',
    message: longMessage(),
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  },
};

const shortTurn: Turn = {
  turnNumber: 5,
  agent: 'CHECKER',
  response: {
    thinking: '',
    message: 'Short message.',
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  },
};

describe('TurnCard', () => {
  // ── Rendering ────────────────────────────────────────────────
  it('renders MAKER turn with maker color class', () => {
    const { container } = render(<TurnCard turn={makerTurn} />);
    expect(screen.getByText('MAKER')).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/border-l-maker/);
  });

  it('renders CHECKER turn with checker color class', () => {
    const { container } = render(<TurnCard turn={checkerTurn} />);
    expect(screen.getByText('CHECKER')).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/border-l-checker/);
  });

  it('shows turn number in compact format', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows action badge', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('shows CONCEDE badge for concede action', () => {
    render(<TurnCard turn={checkerTurn} />);
    expect(screen.getByText('Concede')).toBeInTheDocument();
  });

  it('shows CONCLUDE badge', () => {
    render(<TurnCard turn={concludeTurn} />);
    expect(screen.getByText('Conclude')).toBeInTheDocument();
  });

  it('shows the message text', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(
      screen.getByText('AI should indeed be regulated to ensure safety.'),
    ).toBeInTheDocument();
  });

  it('shows conceded points when present', () => {
    render(<TurnCard turn={checkerTurn} />);
    expect(screen.getByText('Conceded')).toBeInTheDocument();
    expect(screen.getByText('Safety is important')).toBeInTheDocument();
    expect(screen.getByText('Oversight has value')).toBeInTheDocument();
  });

  it('does not show conceded section when list is empty', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(screen.queryByText('Conceded')).not.toBeInTheDocument();
  });

  // ── Verbose / Thinking ───────────────────────────────────────
  it('hides thinking toggle when verbose is false', () => {
    render(<TurnCard turn={makerTurn} verbose={false} />);
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('shows thinking toggle when verbose is true', () => {
    render(<TurnCard turn={makerTurn} verbose={true} />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('expands thinking section on click when verbose', () => {
    render(<TurnCard turn={makerTurn} verbose={true} />);
    expect(screen.queryByText('I am thinking deeply about this topic.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Thinking'));
    expect(screen.getByText('I am thinking deeply about this topic.')).toBeInTheDocument();
  });

  // ── Read more / Read less ────────────────────────────────────
  it('does not show Read more button for short messages', () => {
    render(<TurnCard turn={shortTurn} />);
    expect(screen.queryByTestId('read-more-btn')).not.toBeInTheDocument();
  });

  it('shows Read more button when message exceeds threshold', () => {
    render(<TurnCard turn={longTurn} />);
    expect(screen.getByTestId('read-more-btn')).toBeInTheDocument();
    expect(screen.getByTestId('read-more-btn')).toHaveTextContent('↓ Read more');
  });

  it('applies line-clamp-3 when message is long and collapsed', () => {
    render(<TurnCard turn={longTurn} />);
    const msgEl = screen.getByTestId('turn-message');
    expect(msgEl.className).toMatch(/line-clamp-3/);
  });

  it('removes line-clamp-3 after clicking Read more', () => {
    render(<TurnCard turn={longTurn} />);
    fireEvent.click(screen.getByTestId('read-more-btn'));
    const msgEl = screen.getByTestId('turn-message');
    expect(msgEl.className).not.toMatch(/line-clamp-3/);
  });

  it('changes button text to Read less after expanding', () => {
    render(<TurnCard turn={longTurn} />);
    fireEvent.click(screen.getByTestId('read-more-btn'));
    expect(screen.getByTestId('read-more-btn')).toHaveTextContent('↑ Read less');
  });

  it('re-collapses when Read less is clicked', () => {
    render(<TurnCard turn={longTurn} />);
    fireEvent.click(screen.getByTestId('read-more-btn'));
    fireEvent.click(screen.getByTestId('read-more-btn'));
    const msgEl = screen.getByTestId('turn-message');
    expect(msgEl.className).toMatch(/line-clamp-3/);
    expect(screen.getByTestId('read-more-btn')).toHaveTextContent('↓ Read more');
  });

  it('READ_MORE_THRESHOLD is 280', () => {
    expect(READ_MORE_THRESHOLD).toBe(280);
  });
});
