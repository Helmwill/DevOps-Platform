import os from 'os';
import { statfs } from 'fs/promises';
import Dockerode from 'dockerode';
import { ContainerStats, ServerStats, StatsResponse } from '../types/stats';

// Exported for unit testing
export function calculateCpuPercent(stats: Dockerode.ContainerStats): number {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);

  if (systemDelta <= 0 || cpuDelta < 0) return 0;

  const numCpus =
    stats.cpu_stats.online_cpus ?? stats.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;

  return (cpuDelta / systemDelta) * numCpus * 100;
}

async function getContainerStats(docker: Dockerode): Promise<ContainerStats[]> {
  const containers = await docker.listContainers({ all: false }); // running only
  return Promise.all(
    containers.map(async (c) => {
      const container = docker.getContainer(c.Id);
      const raw = (await container.stats({ stream: false })) as Dockerode.ContainerStats;
      return {
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') ?? c.Id,
        cpu_percent: parseFloat(calculateCpuPercent(raw).toFixed(2)),
        mem_usage_mb: parseFloat((raw.memory_stats.usage / (1024 * 1024)).toFixed(2)),
        mem_limit_mb: parseFloat((raw.memory_stats.limit / (1024 * 1024)).toFixed(2)),
      };
    }),
  );
}

async function getServerStats(): Promise<ServerStats> {
  const fs = await statfs('/');
  const blockSize = fs.bsize;
  const disk_total_gb = parseFloat(((fs.blocks * blockSize) / 1024 ** 3).toFixed(2));
  const disk_used_gb = parseFloat((((fs.blocks - fs.bfree) * blockSize) / 1024 ** 3).toFixed(2));

  const ram_total_mb = parseFloat((os.totalmem() / (1024 * 1024)).toFixed(2));
  const ram_used_mb = parseFloat(
    ((os.totalmem() - os.freemem()) / (1024 * 1024)).toFixed(2),
  );

  return {
    disk_used_gb,
    disk_total_gb,
    ram_used_mb,
    ram_total_mb,
    uptime_seconds: Math.floor(os.uptime()),
    server_time: new Date().toISOString(),
  };
}

export async function getStats(docker: Dockerode): Promise<StatsResponse> {
  const [containers, server] = await Promise.all([getContainerStats(docker), getServerStats()]);
  return { containers, server };
}
