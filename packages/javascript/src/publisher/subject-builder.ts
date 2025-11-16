import { Subject } from '../core/subject';

/**
 * SubjectBuilder - Responsible for constructing NATS subjects
 *
 * Encapsulates all subject construction logic, making it easy to modify
 * subject formatting rules in one place.
 *
 * SOLID Principles:
 * - Single Responsibility: Only builds NATS subjects
 * - Open/Closed: Easy to extend with new subject patterns
 */
export class SubjectBuilder {
  private readonly env: string;
  private readonly appName: string;

  constructor(env: string, appName: string) {
    this.env = env;
    this.appName = appName;
  }

  /**
   * Build NATS subject for a topic
   * Format: {env}.{appName}.{topic}
   *
   * @param topic - Topic name
   * @returns NATS subject string
   */
  buildTopicSubject(topic: string): string {
    return Subject.forTopic(this.env, this.appName, topic);
  }

  /**
   * Build NATS subject from domain/resource/action
   * Maps to topic format: {domain}.{resource}.{action}
   *
   * @param domain - Business domain
   * @param resource - Resource type
   * @param action - Event action
   * @returns NATS subject string
   */
  buildDomainResourceActionSubject(domain: string, resource: string, action: string): string {
    const topic = `${domain}.${resource}.${action}`;
    return this.buildTopicSubject(topic);
  }

  /**
   * Get topic from domain/resource/action
   *
   * @param domain - Business domain
   * @param resource - Resource type
   * @param action - Event action
   * @returns Topic string
   */
  buildTopicFromDomainResourceAction(domain: string, resource: string, action: string): string {
    return `${domain}.${resource}.${action}`;
  }
}
