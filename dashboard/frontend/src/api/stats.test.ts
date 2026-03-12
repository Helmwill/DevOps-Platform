import { formatUptime } from './stats';

describe('formatUptime', () => {
  it('formats minutes only', () => {
    expect(formatUptime(300)).toBe('5m');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3900)).toBe('1h 5m');
  });

  it('formats days, hours, and minutes', () => {
    expect(formatUptime(90060)).toBe('1d 1h 1m');
  });

  it('formats zero uptime as 0m', () => {
    expect(formatUptime(0)).toBe('0m');
  });

  it('omits days when zero', () => {
    expect(formatUptime(7260)).toBe('2h 1m');
  });
});
