import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopicForm } from '@/features/home/components/TopicForm';
import type { DebateConfig } from '@/types/debate';
import { DEFAULT_MAX_TURNS } from '@/lib/constants';

vi.mock('@/lib/api', () => ({
  fetchModels: vi.fn().mockResolvedValue({
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq' },
    ],
    openrouter: [],
  }),
  streamDebate: vi.fn(),
}));

describe('TopicForm', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => {
    mockSubmit.mockClear();
  });

  it('renders the topic textarea', () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    expect(screen.getByPlaceholderText(/Should AI be regulated/i)).toBeInTheDocument();
  });

  it('renders MAKER and CHECKER model selects', () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    expect(screen.getByLabelText(/MAKER Model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CHECKER Model/i)).toBeInTheDocument();
  });

  it('renders the Max Turns input', () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    expect(screen.getByLabelText(/Max Turns/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    expect(screen.getByRole('button', { name: /Start Debate/i })).toBeInTheDocument();
  });

  it('populates model selects after fetch', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    await waitFor(() => {
      const makerSelect = screen.getByLabelText(/MAKER Model/i) as HTMLSelectElement;
      expect(makerSelect.value).toBe('llama-3.3-70b-versatile');
    });
    const checkerSelect = screen.getByLabelText(/CHECKER Model/i) as HTMLSelectElement;
    expect(checkerSelect.value).toBe('llama-3.1-8b-instant');
  });

  it('has default max turns value', () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    const maxTurnsInput = screen.getByLabelText(/Max Turns/i) as HTMLInputElement;
    expect(parseInt(maxTurnsInput.value, 10)).toBe(DEFAULT_MAX_TURNS);
  });

  it('shows validation error when topic is empty', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /Start Debate/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when topic is too short', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    const textarea = screen.getByPlaceholderText(/Should AI be regulated/i);
    await userEvent.type(textarea, 'Too short');
    fireEvent.click(screen.getByRole('button', { name: /Start Debate/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct config when valid', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    // Wait for models to load
    await waitFor(() => {
      const makerSelect = screen.getByLabelText(/MAKER Model/i) as HTMLSelectElement;
      expect(makerSelect.value).not.toBe('');
    });

    const textarea = screen.getByPlaceholderText(/Should AI be regulated/i);
    await userEvent.type(textarea, 'Should artificial intelligence be regulated by governments?');
    fireEvent.click(screen.getByRole('button', { name: /Start Debate/i }));
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    const config: DebateConfig = mockSubmit.mock.calls[0][0];
    expect(config.topic).toBe('Should artificial intelligence be regulated by governments?');
    expect(config.makerModel).toBe('llama-3.3-70b-versatile');
    expect(config.checkerModel).toBe('llama-3.1-8b-instant');
    expect(config.maxTurns).toBe(DEFAULT_MAX_TURNS);
    expect(config.verbose).toBe(false);
  });

  it('disables the button when isLoading is true', () => {
    render(<TopicForm onSubmit={mockSubmit} isLoading={true} />);
    expect(screen.getByRole('button', { name: /Start Debate/i })).toBeDisabled();
  });

  it('clears validation error when user starts typing', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /Start Debate/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const textarea = screen.getByPlaceholderText(/Should AI be regulated/i);
    await userEvent.type(textarea, 'A');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('toggles verbose checkbox', async () => {
    render(<TopicForm onSubmit={mockSubmit} />);
    const textarea = screen.getByPlaceholderText(/Should AI be regulated/i);
    await userEvent.type(textarea, 'Should AI be regulated by international bodies worldwide?');

    const checkboxes = screen.getAllByRole('checkbox');
    const verboseCheckbox = checkboxes.find((cb) =>
      cb.closest('label')?.textContent?.includes('verbose')
    )!;
    expect(verboseCheckbox).not.toBeChecked();
    await userEvent.click(verboseCheckbox);
    expect(verboseCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Start Debate/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0].verbose).toBe(true);
  });
});
