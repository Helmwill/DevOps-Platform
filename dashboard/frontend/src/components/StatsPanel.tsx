import { useEffect, useState, useCallback } from 'react';
import { ServerStats, fetchServerStats, formatUptime } from '../api/stats';

type PanelState = 'loading' | 'error' | 'loaded';

export default function StatsPanel() {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [state, setState] = useState<PanelState>('loading');

  const load = useCallback(async () => {
    try {
      const s = await fetchServerStats();
      setStats(s);
      setState('loaded');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  if (state === 'loading') {
    return (
      <div data-testid="stats-loading" style={{ padding: 16, color: '#6b7280' }}>
        Loading server stats…
      </div>
    );
  }

  if (state === 'error' || !stats) {
    return (
      <div data-testid="stats-error" style={{ padding: 16, color: '#ef4444' }}>
        Failed to load server stats.
      </div>
    );
  }

  const items = [
    { label: 'Server Time', value: new Date(stats.server_time).toLocaleString() },
    { label: 'Uptime', value: formatUptime(stats.uptime_seconds) },
    { label: 'Disk Used', value: `${stats.disk_used_gb} / ${stats.disk_total_gb} GB` },
    { label: 'RAM Used', value: `${stats.ram_used_mb} / ${stats.ram_total_mb} MB` },
  ];

  return (
    <div
      data-testid="stats-panel"
      style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 0' }}
    >
      {items.map(({ label, value }) => (
        <div key={label} style={{ minWidth: 140 }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontWeight: 600 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
