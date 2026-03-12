export interface ContainerStats {
  id: string;
  name: string;
  cpu_percent: number;
  mem_usage_mb: number;
  mem_limit_mb: number;
}

export interface ServerStats {
  disk_used_gb: number;
  disk_total_gb: number;
  ram_used_mb: number;
  ram_total_mb: number;
  uptime_seconds: number;
  server_time: string;
}

export interface StatsResponse {
  containers: ContainerStats[];
  server: ServerStats;
}
