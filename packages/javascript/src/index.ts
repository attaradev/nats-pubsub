// Core
export { default as config } from './core/config';
export { default as connection } from './core/connection';
export { parseDuration, toNanos, fromNanos } from './core/duration';

// Publisher
export { Publisher, default as publisher } from './publisher/publisher';

// Consumer
export { Consumer, default as consumer } from './consumer/consumer';

// Subscriber
export { subscriber, BaseSubscriber } from './subscriber';

// Middleware
export { MiddlewareChain } from './middleware/chain';
export { LoggingMiddleware, default as loggingMiddleware } from './middleware/logging';
export {
  RetryLoggerMiddleware,
  default as retryLoggerMiddleware,
} from './middleware/retry-logger';

// Types
export * from './types';

// Main API
import config from './core/config';
import publisher from './publisher/publisher';
import consumer from './consumer/consumer';
import connection from './core/connection';

export const NatsPubsub = {
  configure: config.configure.bind(config),
  publish: publisher.publish.bind(publisher),
  registerSubscriber: consumer.registerSubscriber.bind(consumer),
  use: consumer.use.bind(consumer),
  start: consumer.start.bind(consumer),
  stop: consumer.stop.bind(consumer),
  connect: connection.connect.bind(connection),
  disconnect: connection.disconnect.bind(connection),
};

export default NatsPubsub;
