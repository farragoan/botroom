import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('fires click handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled state prevents click and applies disabled attr', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('loading state shows spinner and disables button', () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner has role="status"
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('primary variant has gradient classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/from-maker|from-cyan/);
  });

  it('ghost variant has border classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-transparent|border-slate/);
  });

  it('danger variant has red classes', () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/red/);
  });

  it('sm size applies small padding classes', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toMatch(/px-3/);
  });

  it('lg size applies large padding classes', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toMatch(/px-6/);
  });
});
