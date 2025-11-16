import { parseNanos } from '../core/duration';

describe('Duration', () => {
  describe('parseNanos', () => {
    it('should parse nanoseconds', () => {
      expect(parseNanos('100ns')).toBe(100);
      expect(parseNanos('1000ns')).toBe(1000);
    });

    it('should parse microseconds', () => {
      expect(parseNanos('1us')).toBe(1000);
      expect(parseNanos('100us')).toBe(100000);
    });

    it('should parse milliseconds', () => {
      expect(parseNanos('1ms')).toBe(1000000);
      expect(parseNanos('100ms')).toBe(100000000);
    });

    it('should parse seconds', () => {
      expect(parseNanos('1s')).toBe(1000000000);
      expect(parseNanos('30s')).toBe(30000000000);
      expect(parseNanos('60s')).toBe(60000000000);
    });

    it('should parse minutes', () => {
      expect(parseNanos('1m')).toBe(60000000000);
      expect(parseNanos('5m')).toBe(300000000000);
    });

    it('should parse hours', () => {
      expect(parseNanos('1h')).toBe(3600000000000);
      expect(parseNanos('2h')).toBe(7200000000000);
    });

    it('should handle integer input', () => {
      expect(parseNanos(1000000000)).toBe(1000000000);
      expect(parseNanos(500000000)).toBe(500000000);
    });

    it('should handle numeric string input', () => {
      expect(parseNanos('1000000000')).toBe(1000000000);
      expect(parseNanos('500000000')).toBe(500000000);
    });

    it('should handle decimal values', () => {
      expect(parseNanos('0.5s')).toBe(500000000);
      expect(parseNanos('1.5m')).toBe(90000000000);
      expect(parseNanos('2.5h')).toBe(9000000000000);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseNanos('invalid')).toThrow('Invalid duration format');
      expect(() => parseNanos('10x')).toThrow('Invalid duration format');
      expect(() => parseNanos('')).toThrow('Invalid duration format');
    });

    it('should throw error for negative values', () => {
      expect(() => parseNanos('-1s')).toThrow('Invalid duration format');
      expect(() => parseNanos('-100ms')).toThrow('Invalid duration format');
    });

    it('should handle edge cases', () => {
      expect(parseNanos('0s')).toBe(0);
      expect(parseNanos('0ms')).toBe(0);
    });
  });
});
