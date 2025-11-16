/**
 * Parse duration strings like "30s", "5m", "1h" into milliseconds
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Convert milliseconds to nanoseconds (for NATS JetStream)
 */
export function toNanos(ms: number): number {
  return ms * 1_000_000;
}

/**
 * Convert nanoseconds to milliseconds
 */
export function fromNanos(nanos: number): number {
  return nanos / 1_000_000;
}
