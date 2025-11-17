import { ErrorAction, ErrorContext, MessageContext } from '../types';
import { Errors } from '../core/constants';
import config from '../core/config';

/**
 * Subscriber interface with optional error handler
 */
interface SubscriberWithErrorHandler {
  onError?(errorContext: ErrorContext): Promise<ErrorAction> | ErrorAction;
  [key: string]: unknown;
}

/**
 * Enhanced error handler with ErrorAction support
 * Integrates per-subscriber error handling strategies
 */
export class ErrorHandler {
  constructor(
    private readonly subscriber: SubscriberWithErrorHandler,
    private readonly cfg = config.get()
  ) {}

  /**
   * Handle an error from message processing
   *
   * @param error The error that occurred
   * @param message The message payload
   * @param context Message metadata
   * @param attemptNumber Current delivery attempt
   * @returns Error action to take (RETRY, DISCARD, DLQ)
   */
  async handleError(
    error: Error,
    message: Record<string, unknown>,
    context: MessageContext,
    attemptNumber: number
  ): Promise<ErrorAction> {
    const errorContext = this.buildErrorContext(error, message, context, attemptNumber);

    // Try subscriber's custom error handler first
    let action: ErrorAction;
    if (this.subscriber.onError) {
      try {
        action = await this.subscriber.onError(errorContext);
      } catch (handlerError) {
        const logger = this.cfg.logger;
        if (logger && typeof logger.error === 'function') {
          logger.error(`Subscriber error handler failed: ${handlerError}`, {
            subscriber: this.subscriber.constructor.name,
            error: handlerError,
          });
        }
        action = this.determineDefaultAction(errorContext);
      }
    } else {
      action = this.determineDefaultAction(errorContext);
    }

    return this.normalizeAction(action, errorContext);
  }

  /**
   * Build error context object
   */
  private buildErrorContext(
    error: Error,
    message: Record<string, unknown>,
    context: MessageContext,
    attemptNumber: number
  ): ErrorContext {
    const maxAttempts = this.cfg.maxDeliver || 5;
    return {
      error,
      errorClass: error.constructor.name,
      errorMessage: error.message,
      message,
      metadata: context,
      attemptNumber,
      maxAttempts,
      lastAttempt: attemptNumber >= maxAttempts,
      remainingAttempts: Math.max(maxAttempts - attemptNumber, 0),
      retryable: this.isRetryableError(error),
    };
  }

  /**
   * Determine default action based on error type
   */
  private determineDefaultAction(errorContext: ErrorContext): ErrorAction {
    const { error, lastAttempt } = errorContext;

    // Malformed messages -> Discard immediately
    if (this.isMalformedError(error)) {
      return ErrorAction.DISCARD;
    }

    // Unrecoverable errors -> DLQ immediately
    if (this.isUnrecoverableError(error)) {
      return ErrorAction.DLQ;
    }

    // Last attempt -> DLQ
    if (lastAttempt) {
      return ErrorAction.DLQ;
    }

    // Default -> Retry
    return ErrorAction.RETRY;
  }

  /**
   * Check if error indicates malformed message
   */
  private isMalformedError(error: Error): boolean {
    return Errors.MALFORMED_ERRORS.some((errorName) => error.constructor.name.includes(errorName));
  }

  /**
   * Check if error is unrecoverable
   */
  private isUnrecoverableError(error: Error): boolean {
    return Errors.UNRECOVERABLE_ERRORS.some((errorName) =>
      error.constructor.name.includes(errorName)
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    return Errors.TRANSIENT_ERRORS.some((errorName) => error.constructor.name.includes(errorName));
  }

  /**
   * Normalize action to valid ErrorAction
   */
  private normalizeAction(action: ErrorAction, errorContext: ErrorContext): ErrorAction {
    const validActions = Object.values(ErrorAction);
    if (validActions.includes(action)) {
      return action;
    }

    const logger = this.cfg.logger;
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`Invalid error action returned: ${action}, using default`, {
        subscriber: this.subscriber.constructor.name,
        validActions,
      });
    }

    return this.determineDefaultAction(errorContext);
  }
}
