/**
 * Topic subscriber functionality
 * Re-exports from base subscriber module for convenience
 */

export {
  topicSubscriber,
  topicSubscriberWildcard,
  eventSubscriber,
  BaseSubscriber as BaseTopicSubscriber,
  type TopicMetadata,
} from './subscriber';
