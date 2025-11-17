import connection from './connection';
import config from './config';

export interface HealthCheckResult {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp of the health check */
  timestamp: string;
  /** NatsPubsub version */
  version: string;
  /** Individual component health */
  components: {
    nats: ComponentHealth;
    config: ComponentHealth;
    consumers?: ComponentHealth;
  };
  /** Additional details */
  details?: Record<string, unknown>;
}

export interface ComponentHealth {
  /** Component status */
  status: 'up' | 'down' | 'degraded';
  /** Component details */
  details?: Record<string, unknown>;
  /** Error message if down */
  error?: string;
}

/**
 * Health check utility for NatsPubsub
 * Provides information about system health and connectivity
 */
export class HealthCheck {
  /**
   * Perform a comprehensive health check
   *
   * @example
   * ```typescript
   * const health = await HealthCheck.check();
   * console.log(`Status: ${health.status}`);
   * console.log(`NATS: ${health.components.nats.status}`);
   * ```
   */
  static async check(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const components: HealthCheckResult['components'] = {
      nats: await this.checkNats(),
      config: this.checkConfig(),
    };

    // Determine overall status
    const componentStatuses = Object.values(components).map((c) => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (componentStatuses.every((s) => s === 'up')) {
      overallStatus = 'healthy';
    } else if (componentStatuses.some((s) => s === 'down')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp,
      version: this.getVersion(),
      components,
    };
  }

  /**
   * Quick health check - just returns status
   * Faster than full check, suitable for load balancer health endpoints
   */
  static async quickCheck(): Promise<{ status: 'ok' | 'error' }> {
    try {
      const nc = connection.getConnection();
      if (!nc) {
        return { status: 'error' };
      }

      // Check if connection is alive
      const isConnected = !nc.isClosed();
      return { status: isConnected ? 'ok' : 'error' };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * Check NATS connection health
   */
  private static async checkNats(): Promise<ComponentHealth> {
    try {
      const nc = connection.getConnection();

      if (!nc) {
        return {
          status: 'down',
          error: 'No connection established',
        };
      }

      if (nc.isClosed()) {
        return {
          status: 'down',
          error: 'Connection is closed',
        };
      }

      // Get connection stats
      const stats = nc.stats();
      const info = nc.info;

      return {
        status: 'up',
        details: {
          connected: true,
          server: info?.host,
          version: info?.version,
          inMsgs: stats.inMsgs,
          outMsgs: stats.outMsgs,
          inBytes: stats.inBytes,
          outBytes: stats.outBytes,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check configuration health
   */
  private static checkConfig(): ComponentHealth {
    try {
      const cfg = config.get();

      // Check required fields
      const hasRequiredFields = cfg.natsUrls && cfg.env && cfg.appName;

      if (!hasRequiredFields) {
        return {
          status: 'down',
          error: 'Missing required configuration fields',
        };
      }

      return {
        status: 'up',
        details: {
          env: cfg.env,
          appName: cfg.appName,
          natsUrls: cfg.natsUrls,
          concurrency: cfg.concurrency,
          useDlq: cfg.useDlq,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Configuration error',
      };
    }
  }

  /**
   * Get NatsPubsub version
   */
  private static getVersion(): string {
    // This would typically come from package.json
    // For now, return a static version
    return '0.1.0';
  }

  /**
   * Create an Express middleware for health check endpoint
   *
   * @example
   * ```typescript
   * import express from 'express';
   * import { HealthCheck } from 'nats-pubsub';
   *
   * const app = express();
   * app.get('/health', HealthCheck.middleware());
   * ```
   */
  static middleware() {
    return async (req: any, res: any) => {
      try {
        const health = await this.check();
        const statusCode =
          health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    };
  }

  /**
   * Create a quick health check middleware (for load balancers)
   *
   * @example
   * ```typescript
   * app.get('/health/ready', HealthCheck.quickMiddleware());
   * ```
   */
  static quickMiddleware() {
    return async (req: any, res: any) => {
      try {
        const result = await this.quickCheck();
        const statusCode = result.status === 'ok' ? 200 : 503;

        res.status(statusCode).json(result);
      } catch {
        res.status(503).json({ status: 'error' });
      }
    };
  }
}

export default HealthCheck;
