import { Container } from '../api/containers';

const COLORS: Record<Container['status'], string> = {
  running: '#22c55e',
  stopped: '#9ca3af',
  errored: '#ef4444',
};

interface Props {
  status: Container['status'];
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      data-testid="status-badge"
      style={{
        backgroundColor: COLORS[status],
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}
