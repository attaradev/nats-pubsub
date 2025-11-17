/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Circuit is closed, requests flow normally */
  CLOSED = 'closed',
  /** Circuit is open, requests are rejected */
  OPEN = 'open',
  /** Circuit is half-open, testing if service recovered */
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  threshold: number;
  /** Time to keep circuit open in milliseconds */
  timeout: number;
  /** Number of test calls in half-open state */
  halfOpenMaxCalls: number;
  /** Name for logging/monitoring */
  name?: string;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  lastStateChange?: Date;
}

/**
 * Circuit breaker implementation
 *
 * Prevents cascading failures by failing fast when a dependency is unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, requests are rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   threshold: 5,
 *   timeout: 60000,
 *   halfOpenMaxCalls: 3
 * });
 *
 * try {
 *   await breaker.execute(async () => {
 *     return await callExternalService();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerError) {
 *     console.log('Circuit is open!');
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private rejectionCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private lastStateChange?: Date;
  private halfOpenCalls: number = 0;
  private openTimeout?: NodeJS.Timeout;

  constructor(private options: CircuitBreakerOptions) {
    this.validateOptions();
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws CircuitBreakerError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      this.rejectionCount++;
      throw new CircuitBreakerError(
        `Circuit breaker '${this.options.name || 'default'}' is OPEN`,
        this.getStats()
      );
    }

    // Check half-open call limit
    if (
      this.state === CircuitState.HALF_OPEN &&
      this.halfOpenCalls >= this.options.halfOpenMaxCalls
    ) {
      this.rejectionCount++;
      throw new CircuitBreakerError(
        `Circuit breaker '${this.options.name || 'default'}' is HALF_OPEN and at max calls`,
        this.getStats()
      );
    }

    // Track half-open calls
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // If enough successful calls in half-open, close the circuit
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        this.closeCircuit();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately reopens the circuit
      this.openCircuit();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold exceeded
      if (this.failureCount >= this.options.threshold) {
        this.openCircuit();
      }
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.lastStateChange = new Date();
    this.halfOpenCalls = 0;

    // Clear any existing timeout
    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
    }

    // Set timeout to transition to half-open
    this.openTimeout = setTimeout(() => {
      this.halfOpenCircuit();
    }, this.options.timeout);
  }

  /**
   * Transition to half-open state
   */
  private halfOpenCircuit(): void {
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = new Date();
    this.halfOpenCalls = 0;
  }

  /**
   * Close the circuit
   */
  private closeCircuit(): void {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = new Date();
    this.failureCount = 0;
    this.halfOpenCalls = 0;

    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
      this.openTimeout = undefined;
    }
  }

  /**
   * Get current circuit breaker state
   *
   * @returns Current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   *
   * @returns Statistics object
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      rejections: this.rejectionCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.rejectionCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.lastStateChange = new Date();

    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
      this.openTimeout = undefined;
    }
  }

  /**
   * Check if circuit is open
   *
   * @returns True if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   *
   * @returns True if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   *
   * @returns True if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Validate configuration options
   */
  private validateOptions(): void {
    if (this.options.threshold <= 0) {
      throw new Error('Circuit breaker threshold must be positive');
    }
    if (this.options.timeout <= 0) {
      throw new Error('Circuit breaker timeout must be positive');
    }
    if (this.options.halfOpenMaxCalls <= 0) {
      throw new Error('Circuit breaker halfOpenMaxCalls must be positive');
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
      this.openTimeout = undefined;
    }
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Create a circuit breaker instance
 *
 * @param options - Circuit breaker options
 * @returns Circuit breaker instance
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   threshold: 5,
 *   timeout: 60000,
 *   halfOpenMaxCalls: 3,
 *   name: 'payment-service'
 * });
 * ```
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}
