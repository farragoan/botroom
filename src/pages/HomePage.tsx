import { useNavigate } from 'react-router-dom';
import { TopicForm } from '@/features/home/components/TopicForm';
import { useDebate } from '@/features/debate/hooks/useDebate';
import type { DebateConfig } from '@/types/debate';

export default function HomePage() {
  const navigate = useNavigate();
  const { startDebate, status } = useDebate();

  const isLoading = status === 'running';

  async function handleSubmit(config: DebateConfig) {
    navigate('/debate');
    startDebate(config);
  }

  return (
    <div className="flex flex-col items-center px-4 py-12 min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <div className="text-center mb-12 max-w-2xl">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight gradient-text-brand mb-3 select-none">
          Botroom
        </h1>
        <p className="text-base sm:text-lg text-zinc-400">
          An analyst and a reviewer work through your business case, then hand you a write-up.
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Bring your own case text. Botroom ships with no casebook content.
        </p>
      </div>

      {/* Form */}
      <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
