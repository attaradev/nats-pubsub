import { parseDuration, toNanos, fromNanos } from '../core/duration';

describe('Duration - Extended Tests', () => {
  describe('parseDuration', () => {
    it('should parse milliseconds', () => {
      expect(parseDuration('100ms')).toBe(100);
      expect(parseDuration('1000ms')).toBe(1000);
    });

    it('should parse seconds', () => {
      expect(parseDuration('1s')).toBe(1000);
      expect(parseDuration('30s')).toBe(30000);
      expect(parseDuration('60s')).toBe(60000);
    });

    it('should parse minutes', () => {
      expect(parseDuration('1m')).toBe(60000);
      expect(parseDuration('5m')).toBe(300000);
    });

    it('should parse hours', () => {
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('2h')).toBe(7200000);
    });

    it('should handle integer input', () => {
      expect(parseDuration(1000)).toBe(1000);
      expect(parseDuration(5000)).toBe(5000);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
      expect(() => parseDuration('10x')).toThrow('Invalid duration format');
      expect(() => parseDuration('')).toThrow('Invalid duration format');
    });

    it('should handle edge cases', () => {
      expect(parseDuration('0s')).toBe(0);
      expect(parseDuration('0ms')).toBe(0);
    });
  });

  describe('toNanos', () => {
    it('should convert milliseconds to nanoseconds', () => {
      expect(toNanos(1)).toBe(1_000_000);
      expect(toNanos(1000)).toBe(1_000_000_000);
      expect(toNanos(5000)).toBe(5_000_000_000);
    });

    it('should handle zero', () => {
      expect(toNanos(0)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(toNanos(0.5)).toBe(500_000);
      expect(toNanos(1.5)).toBe(1_500_000);
    });

    it('should handle large values', () => {
      expect(toNanos(10000)).toBe(10_000_000_000);
      expect(toNanos(60000)).toBe(60_000_000_000);
    });
  });

  describe('fromNanos', () => {
    it('should convert nanoseconds to milliseconds', () => {
      expect(fromNanos(1_000_000)).toBe(1);
      expect(fromNanos(1_000_000_000)).toBe(1000);
      expect(fromNanos(5_000_000_000)).toBe(5000);
    });

    it('should handle zero', () => {
      expect(fromNanos(0)).toBe(0);
    });

    it('should handle partial milliseconds', () => {
      expect(fromNanos(500_000)).toBe(0.5);
      expect(fromNanos(1_500_000)).toBe(1.5);
    });

    it('should handle large nanosecond values', () => {
      expect(fromNanos(60_000_000_000)).toBe(60000);
      expect(fromNanos(3_600_000_000_000)).toBe(3600000);
    });

    it('should be inverse of toNanos', () => {
      const ms = 12345;
      expect(fromNanos(toNanos(ms))).toBe(ms);
    });
  });
});
