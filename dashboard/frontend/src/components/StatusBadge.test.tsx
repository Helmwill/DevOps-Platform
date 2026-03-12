import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders "running" with green background', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('running');
    expect(badge).toHaveStyle({ backgroundColor: '#22c55e' });
  });

  it('renders "stopped" with grey background', () => {
    render(<StatusBadge status="stopped" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('stopped');
    expect(badge).toHaveStyle({ backgroundColor: '#9ca3af' });
  });

  it('renders "errored" with red background', () => {
    render(<StatusBadge status="errored" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('errored');
    expect(badge).toHaveStyle({ backgroundColor: '#ef4444' });
  });
});
