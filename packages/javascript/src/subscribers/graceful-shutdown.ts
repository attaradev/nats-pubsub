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
 * Handles signal trapping and ensures clean shutdown with message drain.
 *
 * Uses Consumer.stop() which calls NATS connection.drain() under the hood.
 * NATS drain stops accepting new messages, waits for in-flight messages to
 * complete, then closes the connection — providing built-in graceful shutdown.
 */
export class GracefulShutdown {
  private readonly timeout: number;
  private readonly logger?: Logger;
  private shuttingDown = false;

  private static readonly DEFAULT_TIMEOUT = 30_000; // 30 seconds

  constructor(
    private readonly consumer: Consumer,
    options: GracefulShutdownOptions = {}
  ) {
    this.timeout = options.timeout || GracefulShutdown.DEFAULT_TIMEOUT;
    this.logger = options.logger;
  }

  /**
   * Start graceful shutdown process.
   * Calls consumer.stop() with a timeout to ensure shutdown completes.
   * NATS drain handles waiting for in-flight messages.
   * @returns True if shutdown completed within timeout
   */
  async shutdown(): Promise<boolean> {
    if (this.shuttingDown) {
      return false;
    }

    this.shuttingDown = true;
    const startedAt = Date.now();

    this.logger?.info('Starting graceful shutdown', { timeout: this.timeout });

    try {
      // consumer.stop() calls connection.drain() + connection.close()
      // which handles the graceful message drain natively
      await Promise.race([
        this.consumer.stop(),
        this.sleep(this.timeout).then(() => {
          throw new Error('Shutdown timeout reached');
        }),
      ]);

      const elapsed = Date.now() - startedAt;
      this.logger?.info('Graceful shutdown complete', { elapsed, graceful: true });
      return true;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      this.logger?.warn('Graceful shutdown timed out, forcing stop', {
        elapsed,
        timeout: this.timeout,
      });

      // Force stop by calling stop again (idempotent)
      try {
        await this.consumer.stop();
      } catch {
        // Already stopped or connection lost — safe to ignore
      }

      return false;
    }
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
