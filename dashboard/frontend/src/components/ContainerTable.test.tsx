import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ContainerTable from './ContainerTable';

const mockContainer = {
  id: 'abc',
  name: 'web',
  image: 'nginx:latest',
  status: 'running' as const,
  created: 1700000000,
};

const mockStats = {
  containers: [{ id: 'abc', cpu_percent: 4.0, mem_usage_mb: 128, mem_limit_mb: 512, name: 'web' }],
  server: {},
};

function mockFetch(responses: Record<string, unknown>) {
  vi.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = input.toString();
    for (const [key, body] of Object.entries(responses)) {
      if (url.includes(key)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body),
        } as Response);
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  });
}

afterEach(() => vi.restoreAllMocks());

describe('ContainerTable', () => {
  it('renders container row with badge and stats', async () => {
    mockFetch({ '/api/containers': [mockContainer], '/api/stats': mockStats });
    render(<ContainerTable />);

    await waitFor(() => expect(screen.getByText('web')).toBeInTheDocument());
    expect(screen.getByTestId('status-badge')).toHaveTextContent('running');
    expect(screen.getByText('nginx:latest')).toBeInTheDocument();
  });

  it('disables all buttons while an action is in-flight', async () => {
    let resolveAction: () => void;
    const actionPromise = new Promise<void>((res) => { resolveAction = res; });

    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = input.toString();
      if (url.includes('/api/containers') && !url.includes('/start')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([mockContainer]) } as Response);
      }
      if (url.includes('/api/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) } as Response);
      }
      // action call — hangs until resolved
      return actionPromise.then(() => ({ ok: true, json: () => Promise.resolve({}) } as Response));
    });

    render(<ContainerTable />);
    await waitFor(() => expect(screen.getByText('web')).toBeInTheDocument());

    const startBtn = screen.getByRole('button', { name: 'start' });
    fireEvent.click(startBtn);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => expect(btn).toBeDisabled());
    });

    resolveAction!();
  });

  it('shows error toast when action returns non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = input.toString();
      if (url.includes('/api/containers') && !url.includes('/start')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([mockContainer]) } as Response);
      }
      if (url.includes('/api/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) } as Response);
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Container is already running' }),
      } as Response);
    });

    render(<ContainerTable />);
    await waitFor(() => expect(screen.getByText('web')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Container is already running'),
    );
  });
});
