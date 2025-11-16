import { Publisher } from './publisher';

/**
 * Publisher for topic-based messaging
 * Alias for Publisher class for backward compatibility
 */
export class TopicPublisher extends Publisher {}

export default new TopicPublisher();
