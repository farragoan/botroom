import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders CONTINUE action with correct text', () => {
    render(<Badge action="CONTINUE" />);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('CONTINUE action has slate styling', () => {
    const { container } = render(<Badge action="CONTINUE" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/bg-slate-700/);
    expect(badge.className).toMatch(/text-slate-300/);
  });

  it('renders CONCLUDE action with correct text and styling', () => {
    render(<Badge action="CONCLUDE" />);
    const badge = screen.getByText('Conclude');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/emerald/);
  });

  it('renders CONCEDE action with correct text and styling', () => {
    render(<Badge action="CONCEDE" />);
    const badge = screen.getByText('Concede');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/amber/);
  });

  it('renders maker variant', () => {
    render(<Badge variant="maker">MAKER</Badge>);
    const badge = screen.getByText('MAKER');
    expect(badge.className).toMatch(/bg-maker-dim/);
    expect(badge.className).toMatch(/text-maker/);
  });

  it('renders checker variant', () => {
    render(<Badge variant="checker">CHECKER</Badge>);
    const badge = screen.getByText('CHECKER');
    expect(badge.className).toMatch(/bg-checker-dim/);
    expect(badge.className).toMatch(/text-checker/);
  });

  it('renders children for generic variant', () => {
    render(<Badge variant="default">Custom</Badge>);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
