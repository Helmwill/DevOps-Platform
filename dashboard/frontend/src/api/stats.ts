export interface ServerStats {
  disk_used_gb: number;
  disk_total_gb: number;
  ram_used_mb: number;
  ram_total_mb: number;
  uptime_seconds: number;
  server_time: string;
}

export interface StatsResponse {
  containers: unknown[];
  server: ServerStats;
}

export async function fetchServerStats(): Promise<ServerStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  const data: StatsResponse = await res.json();
  return data.server;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}
