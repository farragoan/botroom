import { render, screen, fireEvent } from '@testing-library/react';
import { TurnCard } from '@/features/debate/components/TurnCard';
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

describe('TurnCard', () => {
  it('renders MAKER turn with maker color class', () => {
    const { container } = render(<TurnCard turn={makerTurn} />);
    expect(screen.getByText('MAKER')).toBeInTheDocument();
    // border-l-maker on the card
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/border-l-maker/);
  });

  it('renders CHECKER turn with checker color class', () => {
    const { container } = render(<TurnCard turn={checkerTurn} />);
    expect(screen.getByText('CHECKER')).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/border-l-checker/);
  });

  it('shows turn number', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
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
      screen.getByText('AI should indeed be regulated to ensure safety.')
    ).toBeInTheDocument();
  });

  it('shows conceded points when present', () => {
    render(<TurnCard turn={checkerTurn} />);
    expect(screen.getByText('Conceded Points')).toBeInTheDocument();
    expect(screen.getByText('Safety is important')).toBeInTheDocument();
    expect(screen.getByText('Oversight has value')).toBeInTheDocument();
  });

  it('does not show conceded points when empty', () => {
    render(<TurnCard turn={makerTurn} />);
    expect(screen.queryByText('Conceded Points')).not.toBeInTheDocument();
  });

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
    const toggle = screen.getByText('Thinking');
    // Thinking text not visible before click
    expect(
      screen.queryByText('I am thinking deeply about this topic.')
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(
      screen.getByText('I am thinking deeply about this topic.')
    ).toBeInTheDocument();
  });
});
