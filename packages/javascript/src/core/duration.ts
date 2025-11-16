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

/**
 * Parse duration strings and convert to nanoseconds
 * Supports: ns, us, ms, s, m, h
 */
export function parseNanos(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }

  // Handle numeric strings
  const numericValue = parseFloat(duration);
  if (!isNaN(numericValue) && duration === numericValue.toString()) {
    return numericValue;
  }

  const match = duration.match(/^(\d+(?:\.\d+)?)(ns|us|ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ns':
      return value;
    case 'us':
      return value * 1000;
    case 'ms':
      return value * 1_000_000;
    case 's':
      return value * 1_000_000_000;
    case 'm':
      return value * 60 * 1_000_000_000;
    case 'h':
      return value * 60 * 60 * 1_000_000_000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
