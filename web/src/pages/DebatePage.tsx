import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DebateArena } from '@/features/debate/components/DebateArena';
import { useDebate } from '@/features/debate/hooks/useDebate';

export default function DebatePage() {
  const { status } = useDebate();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'idle') {
      navigate('/', { replace: true });
    }
  }, [status, navigate]);

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col">
      <DebateArena />
    </div>
  );
}
