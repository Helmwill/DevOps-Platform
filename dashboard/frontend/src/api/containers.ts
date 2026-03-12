export interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'errored';
  created: number;
}

export interface ContainerStat {
  id: string;
  cpu_percent: number;
  mem_usage_mb: number;
  mem_limit_mb: number;
}

export async function fetchContainers(): Promise<Container[]> {
  const res = await fetch('/api/containers');
  if (!res.ok) throw new Error(`Failed to fetch containers: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<{ containers: ContainerStat[] }> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}

export async function containerAction(
  id: string,
  action: 'start' | 'stop' | 'restart',
): Promise<void> {
  const res = await fetch(`/api/containers/${id}/${action}`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Action failed: ${res.status}`);
  }
}
