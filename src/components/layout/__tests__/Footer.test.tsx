import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
  it('renders the build version string', () => {
    render(<Footer />);
    // The footer renders the raw version string (no "build" prefix in new design)
    expect(screen.getByText(/v10/i)).toBeInTheDocument();
  });

  it('displays a version matching the v10YYMMDDNNN format', () => {
    render(<Footer />);
    const el = screen.getByText(/v10/i);
    // Format: v10{YY}{MM}{DD}{NNN}  e.g. v109901010001
    expect(el.textContent).toMatch(/^v10\d{9}$/);
  });

  it('version contains the injected __APP_VERSION__ constant', () => {
    render(<Footer />);
    const el = screen.getByText(/v10/i);
    expect(el.textContent).toContain(__APP_VERSION__);
  });
});
