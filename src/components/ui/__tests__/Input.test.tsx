import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('does not show error message when no error', () => {
    render(<Input label="Email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('onChange fires on input change', () => {
    const handleChange = vi.fn();
    render(<Input label="Name" onChange={handleChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('required attribute is passed through', () => {
    render(<Input label="Topic" required />);
    expect(screen.getByLabelText('Topic')).toBeRequired();
  });

  it('shows helper text when no error', () => {
    render(<Input label="Topic" helperText="Be specific" />);
    expect(screen.getByText('Be specific')).toBeInTheDocument();
  });

  it('hides helper text when error is shown', () => {
    render(<Input label="Topic" error="Required" helperText="Be specific" />);
    expect(screen.queryByText('Be specific')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
