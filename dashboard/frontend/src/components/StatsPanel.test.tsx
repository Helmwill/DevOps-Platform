import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import StatsPanel from './StatsPanel';

const mockStats = {
  containers: [],
  server: {
    disk_used_gb: 12.4,
    disk_total_gb: 50.0,
    ram_used_mb: 1024,
    ram_total_mb: 4096,
    uptime_seconds: 90060,
    server_time: '2026-03-12T12:00:00.000Z',
  },
};

afterEach(() => vi.restoreAllMocks());

describe('StatsPanel', () => {
  it('shows loading skeleton initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<StatsPanel />);
    expect(screen.getByTestId('stats-loading')).toBeInTheDocument();
  });

  it('renders populated stats after fetch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats),
    } as Response);

    render(<StatsPanel />);
    await waitFor(() => expect(screen.getByTestId('stats-panel')).toBeInTheDocument());

    expect(screen.getByText('1d 1h 1m')).toBeInTheDocument();
    expect(screen.getByText('12.4 / 50 GB')).toBeInTheDocument();
    expect(screen.getByText('1024 / 4096 MB')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    render(<StatsPanel />);
    await waitFor(() => expect(screen.getByTestId('stats-error')).toBeInTheDocument());
  });
});
