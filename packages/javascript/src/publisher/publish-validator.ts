import { DomainResourceActionParams, MultiTopicParams } from './types';

/**
 * PublishValidator - Responsible for validating publish parameters
 *
 * Centralizes all validation logic for publish operations, making it
 * easy to maintain and test validation rules.
 *
 * SOLID Principles:
 * - Single Responsibility: Only validates publish parameters
 * - Open/Closed: Easy to add new validation rules
 */
export class PublishValidator {
  /**
   * Validate topic name
   *
   * @param topic - Topic to validate
   * @throws Error if topic is invalid
   */
  validateTopic(topic: string): void {
    if (!topic || typeof topic !== 'string') {
      throw new Error('Topic must be a non-empty string');
    }

    if (topic.trim().length === 0) {
      throw new Error('Topic cannot be empty or whitespace only');
    }
  }

  /**
   * Validate message payload
   *
   * @param message - Message to validate
   * @throws Error if message is invalid
   */
  validateMessage(message: Record<string, unknown>): void {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }

    if (Array.isArray(message)) {
      throw new Error('Message cannot be an array');
    }
  }

  /**
   * Validate domain/resource/action parameters
   *
   * @param params - Parameters to validate
   * @throws Error if parameters are invalid
   */
  validateDomainResourceAction(params: DomainResourceActionParams): void {
    const { domain, resource, action, payload } = params;

    if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
      throw new Error('Domain must be a non-empty string');
    }

    if (!resource || typeof resource !== 'string' || resource.trim().length === 0) {
      throw new Error('Resource must be a non-empty string');
    }

    if (!action || typeof action !== 'string' || action.trim().length === 0) {
      throw new Error('Action must be a non-empty string');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Payload must be a non-array object');
    }
  }

  /**
   * Validate multi-topic parameters
   *
   * @param params - Parameters to validate
   * @throws Error if parameters are invalid
   */
  validateMultiTopicParams(params: MultiTopicParams): void {
    const { topics, message } = params;

    if (!Array.isArray(topics)) {
      throw new Error('Topics must be an array');
    }

    if (topics.length === 0) {
      throw new Error('Topics array cannot be empty');
    }

    // Validate each topic
    for (const topic of topics) {
      this.validateTopic(topic);
    }

    this.validateMessage(message);
  }

  /**
   * Validate topics array
   *
   * @param topics - Topics to validate
   * @throws Error if topics are invalid
   */
  validateTopicsArray(topics: string[]): void {
    if (!Array.isArray(topics)) {
      throw new Error('Topics must be an array');
    }

    if (topics.length === 0) {
      throw new Error('Topics array cannot be empty');
    }

    for (const topic of topics) {
      this.validateTopic(topic);
    }
  }
}
