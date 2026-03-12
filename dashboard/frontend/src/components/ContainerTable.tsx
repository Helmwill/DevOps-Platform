import { useEffect, useState, useCallback } from 'react';
import { Container, ContainerStat, fetchContainers, fetchStats, containerAction } from '../api/containers';
import StatusBadge from './StatusBadge';

type Action = 'start' | 'stop' | 'restart';

export default function ContainerTable() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [stats, setStats] = useState<Map<string, ContainerStat>>(new Map());
  const [loading, setLoading] = useState<Record<string, Action | null>>({});
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cs, st] = await Promise.all([fetchContainers(), fetchStats()]);
      setContainers(cs);
      setStats(new Map(st.containers.map((s) => [s.id, s])));
    } catch {
      // silently retry on next interval
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleAction = async (id: string, action: Action) => {
    setLoading((prev) => ({ ...prev, [id]: action }));
    try {
      await containerAction(id, action);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  return (
    <div>
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            background: '#ef4444',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 6,
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Name', 'Image', 'Status', 'CPU %', 'Memory (MB)', 'Actions'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {containers.map((c) => {
            const stat = stats.get(c.id);
            const busy = loading[c.id];
            return (
              <tr key={c.id}>
                <td style={{ padding: '8px' }}>{c.name}</td>
                <td style={{ padding: '8px' }}>{c.image}</td>
                <td style={{ padding: '8px' }}>
                  <StatusBadge status={c.status} />
                </td>
                <td style={{ padding: '8px' }}>{stat ? stat.cpu_percent.toFixed(1) : '—'}</td>
                <td style={{ padding: '8px' }}>
                  {stat ? `${stat.mem_usage_mb.toFixed(0)} / ${stat.mem_limit_mb.toFixed(0)}` : '—'}
                </td>
                <td style={{ padding: '8px', display: 'flex', gap: 4 }}>
                  {(['start', 'stop', 'restart'] as Action[]).map((action) => (
                    <button
                      key={action}
                      disabled={!!busy}
                      onClick={() => handleAction(c.id, action)}
                      style={{ opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      {busy === action ? '…' : action}
                    </button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
