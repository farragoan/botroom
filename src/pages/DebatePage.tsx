import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DebateArena } from '@/features/debate/components/DebateArena';
import { useDebate } from '@/features/debate/hooks/useDebate';

export default function DebatePage() {
  const { status } = useDebate();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'idle') {
      navigate('/arena', { replace: true });
    }
  }, [status, navigate]);

  if (status === 'idle') {
    return null;
  }

  return (
    // Fixed-height container so only the message feed scrolls, not the whole page
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <DebateArena />
    </div>
  );
}
