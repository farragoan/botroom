// src/pages/HistoryPage.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'react-router-dom';
import { API_BASE } from '@/lib/constants';

interface DebateSummary {
  id: string;
  topic: string;
  maker_model: string;
  checker_model: string;
  status: string;
  total_cost_paise: number;
  created_at: string;
}

export default function HistoryPage() {
  const { getToken } = useAuth();
  const [debates, setDebates] = useState<DebateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/debates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDebates(await res.json() as DebateSummary[]);
      setLoading(false);
    })();
  }, [getToken]);

  if (loading) return <div className="p-8 text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Debate History</h1>
      {debates.length === 0 && (
        <p className="text-zinc-400">No debates yet. <Link to="/" className="text-indigo-400 hover:underline">Start one.</Link></p>
      )}
      <ul className="space-y-3">
        {debates.map(d => (
          <li key={d.id} className="bg-zinc-800 rounded-lg p-4">
            <p className="text-white font-medium truncate">{d.topic}</p>
            <p className="text-zinc-400 text-sm mt-1">
              {d.maker_model} vs {d.checker_model} · ₹{(d.total_cost_paise / 100).toFixed(2)} · {new Date(d.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
