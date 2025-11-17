/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  pid: number;
  [key: string]: unknown;
}

/**
 * Structured logger for machine-parseable JSON logs
 */
export class StructuredLogger {
  private readonly context: Record<string, unknown>;

  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(
    private readonly level: LogLevel = 'info',
    context: Record<string, unknown> = {}
  ) {
    this.context = context;
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log at info level
   */
  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('info', message, metadata);
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log at error level
   */
  error(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('error', message, metadata);
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('fatal', message, metadata);
  }

  /**
   * Create child logger with additional context
   */
  withContext(childContext: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger(this.level, {
      ...this.context,
      ...childContext,
    });
  }

  /**
   * Log a message
   */
  private log(severity: LogLevel, message: string, metadata: Record<string, unknown>): void {
    if (StructuredLogger.LEVELS[severity] < StructuredLogger.LEVELS[this.level]) {
      return;
    }

    const logEntry = this.buildLogEntry(severity, message, metadata);

    try {
      console.log(JSON.stringify(logEntry));
    } catch {
      // Fallback to plain text if JSON fails
      console.log(`[${severity}] ${message}`);
    }
  }

  /**
   * Build structured log entry
   */
  private buildLogEntry(
    severity: LogLevel,
    message: string,
    metadata: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: severity.toUpperCase(),
      message,
      pid: process.pid,
      ...this.context,
      ...metadata,
    };
  }
}

/**
 * Logger factory for creating structured loggers
 */
export class LoggerFactory {
  /**
   * Create a structured logger from configuration
   */
  static createFromConfig(config: {
    logLevel?: LogLevel;
    appName?: string;
    env?: string;
  }): StructuredLogger {
    const level = config.logLevel || 'info';

    return new StructuredLogger(level, {
      app_name: config.appName,
      env: config.env,
    });
  }

  /**
   * Create a logger for a specific component
   */
  static forComponent(
    component: string,
    config: { logLevel?: LogLevel; appName?: string; env?: string }
  ): StructuredLogger {
    return this.createFromConfig(config).withContext({ component });
  }
}
