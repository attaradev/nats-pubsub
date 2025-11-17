import { Consumer } from './consumer';

/**
 * Logger interface for graceful shutdown
 */
interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Graceful shutdown configuration
 */
export interface GracefulShutdownOptions {
  timeout?: number; // milliseconds
  logger?: Logger;
}

/**
 * Graceful shutdown manager for subscribers
 * Handles signal trapping and ensures clean shutdown with message drain
 */
export class GracefulShutdown {
  private readonly timeout: number;
  private readonly logger?: Logger;
  private shuttingDown = false;
  private shutdownStartedAt?: Date;

  private static readonly DEFAULT_TIMEOUT = 30_000; // 30 seconds

  constructor(
    private readonly consumer: Consumer,
    options: GracefulShutdownOptions = {}
  ) {
    this.timeout = options.timeout || GracefulShutdown.DEFAULT_TIMEOUT;
    this.logger = options.logger;
  }

  /**
   * Start graceful shutdown process
   * @returns True if shutdown completed gracefully within timeout
   */
  async shutdown(): Promise<boolean> {
    if (this.shuttingDown) {
      return false;
    }

    this.shuttingDown = true;
    this.shutdownStartedAt = new Date();

    this.logger?.info('Starting graceful shutdown', { timeout: this.timeout });

    // Stop accepting new messages
    await this.stopAcceptingMessages();

    // Wait for in-flight messages
    const completed = await this.waitForCompletion();

    // Force terminate if needed
    if (!completed) {
      await this.forceTerminate();
    }

    // Close connections
    await this.closeConnections();

    const elapsed = Date.now() - this.shutdownStartedAt.getTime();
    this.logger?.info('Graceful shutdown complete', {
      elapsed,
      graceful: completed,
    });

    return completed;
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Install signal handlers for graceful shutdown
   * Traps SIGTERM and SIGINT
   */
  installSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.logger?.info(`Received ${signal}, initiating shutdown`);
        this.shutdown()
          .then(() => process.exit(0))
          .catch((error) => {
            this.logger?.error('Shutdown failed', { error });
            process.exit(1);
          });
      });
    });
  }

  /**
   * Stop accepting new messages
   */
  private async stopAcceptingMessages(): Promise<void> {
    this.logger?.info('Stopping message acceptance');
    if (typeof this.consumer.pause === 'function') {
      await this.consumer.pause();
    }
  }

  /**
   * Wait for in-flight messages to complete
   */
  private async waitForCompletion(): Promise<boolean> {
    const deadline = Date.now() + this.timeout;

    while (true) {
      const inFlight =
        typeof this.consumer.getInFlightCount === 'function' ? this.consumer.getInFlightCount() : 0;

      if (inFlight === 0) {
        this.logger?.info('All messages processed');
        return true;
      }

      if (Date.now() >= deadline) {
        this.logger?.warn('Shutdown timeout reached', {
          inFlight,
          timeout: this.timeout,
        });
        return false;
      }

      this.logger?.debug('Waiting for messages', {
        inFlight,
        remaining: deadline - Date.now(),
      });

      await this.sleep(500);
    }
  }

  /**
   * Force terminate remaining messages
   */
  private async forceTerminate(): Promise<void> {
    this.logger?.warn('Force terminating remaining messages');
    if (typeof this.consumer.forceStop === 'function') {
      await this.consumer.forceStop();
    }
  }

  /**
   * Close connections
   */
  private async closeConnections(): Promise<void> {
    this.logger?.info('Closing connections');
    if (typeof this.consumer.close === 'function') {
      await this.consumer.close();
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
