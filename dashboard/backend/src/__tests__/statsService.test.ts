import Dockerode from 'dockerode';
import { calculateCpuPercent } from '../services/statsService';

function makeStats(
  totalUsage: number,
  preTotalUsage: number,
  systemUsage: number,
  preSystemUsage: number,
  onlineCpus = 2,
): Dockerode.ContainerStats {
  return {
    cpu_stats: {
      cpu_usage: { total_usage: totalUsage, percpu_usage: [0, 0] },
      system_cpu_usage: systemUsage,
      online_cpus: onlineCpus,
      throttling_data: { throttled_periods: 0, throttled_time: 0, periods: 0 },
    },
    precpu_stats: {
      cpu_usage: { total_usage: preTotalUsage, percpu_usage: [0, 0] },
      system_cpu_usage: preSystemUsage,
      online_cpus: onlineCpus,
      throttling_data: { throttled_periods: 0, throttled_time: 0, periods: 0 },
    },
  } as unknown as Dockerode.ContainerStats;
}

describe('calculateCpuPercent', () => {
  it('calculates cpu percent correctly', () => {
    // cpu_delta = 200_000_000, system_delta = 10_000_000_000, cpus = 2
    // expected = (200_000_000 / 10_000_000_000) * 2 * 100 = 4%
    const result = calculateCpuPercent(makeStats(200_000_000, 0, 10_000_000_000, 0, 2));
    expect(result).toBeCloseTo(4, 1);
  });

  it('returns 0 when cpu delta is zero', () => {
    const result = calculateCpuPercent(makeStats(100, 100, 10_000_000_000, 0, 2));
    expect(result).toBe(0);
  });

  it('returns 0 when system delta is zero', () => {
    const result = calculateCpuPercent(makeStats(200_000_000, 0, 100, 100, 2));
    expect(result).toBe(0);
  });

  it('returns 0 when system delta is negative', () => {
    const result = calculateCpuPercent(makeStats(200_000_000, 0, 0, 100, 2));
    expect(result).toBe(0);
  });

  it('falls back to percpu_usage length when online_cpus is undefined', () => {
    // makeStats creates percpu_usage: [0, 0] — length 2
    const stats = makeStats(200_000_000, 0, 10_000_000_000, 0, 2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (stats.cpu_stats as any).online_cpus;
    const result = calculateCpuPercent(stats);
    expect(result).toBeCloseTo(4, 1); // 2 cpus from percpu_usage length
  });

  it('falls back to 1 cpu when both online_cpus and percpu_usage are undefined', () => {
    const stats = makeStats(200_000_000, 0, 10_000_000_000, 0, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (stats.cpu_stats as any).online_cpus;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (stats.cpu_stats.cpu_usage as any).percpu_usage;
    const result = calculateCpuPercent(stats);
    expect(result).toBeCloseTo(2, 1); // 1 cpu fallback
  });

  it('handles undefined system_cpu_usage gracefully', () => {
    const stats = makeStats(200_000_000, 0, 10_000_000_000, 0, 2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (stats.cpu_stats as any).system_cpu_usage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (stats.precpu_stats as any).system_cpu_usage;
    // system_delta = 0 - 0 = 0 → returns 0
    const result = calculateCpuPercent(stats);
    expect(result).toBe(0);
  });
});
