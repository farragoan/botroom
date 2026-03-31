import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
  it('renders the build version string', () => {
    render(<Footer />);
    expect(screen.getByText(/build/i)).toBeInTheDocument();
  });

  it('displays a CalVer-formatted version (YYYY.MM.DD)', () => {
    render(<Footer />);
    const text = screen.getByText(/build/i).textContent ?? '';
    expect(text).toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });

  it('version matches the injected __APP_VERSION__ constant', () => {
    render(<Footer />);
    const text = screen.getByText(/build/i).textContent ?? '';
    expect(text).toContain(__APP_VERSION__);
  });
});
