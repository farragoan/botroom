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
        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent mb-4 select-none">
          BOTROOM
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 font-light tracking-wide">
          Two AI minds.&nbsp;&nbsp;One topic.&nbsp;&nbsp;Fight to consensus.
        </p>
      </div>

      {/* Form */}
      <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
