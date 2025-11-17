/**
 * Subject utility class for building and parsing NATS subjects
 *
 * This class centralizes all subject/topic logic to eliminate duplication
 * and provide a single source of truth for subject formatting.
 *
 * Subject patterns:
 * - Topic-based: {env}.{appName}.{topic}
 * - Event-based: {env}.events.{domain}.{resource}.{action}
 * - DLQ: {env}.dlq
 */
export class Subject {
  /**
   * Build a subject for topic-based messaging
   *
   * @param env - Environment (e.g., 'production', 'staging', 'development')
   * @param appName - Application name
   * @param topic - Topic name (supports hierarchical topics with dots)
   * @returns Formatted NATS subject
   *
   * @example
   * ```typescript
   * Subject.forTopic('production', 'myapp', 'user.created')
   * // Returns: 'production.myapp.user.created'
   *
   * Subject.forTopic('production', 'myapp', 'notifications.email')
   * // Returns: 'production.myapp.notifications.email'
   * ```
   */
  static forTopic(env: string, appName: string, topic: string): string {
    const normalizedTopic = this.normalizeName(topic);
    return `${env}.${appName}.${normalizedTopic}`;
  }

  /**
   * Build a subject for event-based messaging (domain/resource/action)
   *
   * @param env - Environment
   * @param domain - Business domain (e.g., 'users', 'orders')
   * @param resource - Resource type (e.g., 'user', 'order')
   * @param action - Event action (e.g., 'created', 'updated', 'deleted')
   * @returns Formatted NATS subject
   *
   * @example
   * ```typescript
   * Subject.forEvent('production', 'users', 'user', 'created')
   * // Returns: 'production.events.users.user.created'
   * ```
   */
  static forEvent(env: string, domain: string, resource: string, action: string): string {
    const normalizedDomain = this.normalizeName(domain);
    const normalizedResource = this.normalizeName(resource);
    const normalizedAction = this.normalizeName(action);

    return `${env}.events.${normalizedDomain}.${normalizedResource}.${normalizedAction}`;
  }

  /**
   * Build a DLQ (Dead Letter Queue) subject
   *
   * @param env - Environment
   * @returns Formatted NATS DLQ subject
   *
   * @example
   * ```typescript
   * Subject.forDlq('production')
   * // Returns: 'production.dlq'
   * ```
   */
  static forDlq(env: string): string {
    return `${env}.dlq`;
  }

  /**
   * Build a wildcard subject pattern for subscribing to all events
   *
   * @param env - Environment
   * @returns Subject pattern with NATS wildcard
   *
   * @example
   * ```typescript
   * Subject.allEvents('production')
   * // Returns: 'production.events.>'
   * ```
   */
  static allEvents(env: string): string {
    return `${env}.events.>`;
  }

  /**
   * Parse a topic-based subject into its components
   *
   * @param subject - NATS subject string
   * @returns Object with env, appName, and topic, or null if invalid format
   *
   * @example
   * ```typescript
   * Subject.parseTopic('production.myapp.user.created')
   * // Returns: { env: 'production', appName: 'myapp', topic: 'user.created' }
   * ```
   */
  static parseTopic(subject: string): {
    env: string;
    appName: string;
    topic: string;
  } | null {
    const parts = subject.split('.');

    if (parts.length < 3) {
      return null;
    }

    const [env, appName, ...topicParts] = parts;
    return {
      env,
      appName,
      topic: topicParts.join('.'),
    };
  }

  /**
   * Parse an event-based subject into its components
   *
   * @param subject - NATS subject string
   * @returns Object with env, domain, resource, and action, or null if invalid format
   *
   * @example
   * ```typescript
   * Subject.parseEvent('production.events.users.user.created')
   * // Returns: { env: 'production', domain: 'users', resource: 'user', action: 'created' }
   * ```
   */
  static parseEvent(subject: string): {
    env: string;
    domain: string;
    resource: string;
    action: string;
  } | null {
    const parts = subject.split('.');

    if (parts.length !== 5 || parts[1] !== 'events') {
      return null;
    }

    return {
      env: parts[0],
      domain: parts[2],
      resource: parts[3],
      action: parts[4],
    };
  }

  /**
   * Check if a subject is a topic-based subject
   *
   * @param subject - NATS subject string
   * @returns true if subject follows topic pattern
   *
   * @example
   * ```typescript
   * Subject.isTopic('production.myapp.user.created') // true
   * Subject.isTopic('production.events.users.user.created') // false
   * ```
   */
  static isTopic(subject: string): boolean {
    const parts = subject.split('.');
    return parts.length >= 3 && parts[1] !== 'events';
  }

  /**
   * Check if a subject is an event-based subject
   *
   * @param subject - NATS subject string
   * @returns true if subject follows event pattern
   *
   * @example
   * ```typescript
   * Subject.isEvent('production.events.users.user.created') // true
   * Subject.isEvent('production.myapp.user.created') // false
   * ```
   */
  static isEvent(subject: string): boolean {
    const parts = subject.split('.');
    return parts.length >= 5 && parts[1] === 'events';
  }

  /**
   * Normalize a name for use in subjects
   *
   * Converts to lowercase and replaces special characters with underscores.
   * Preserves dots (.), NATS wildcards (> and *), and hyphens (-).
   *
   * @param name - Name to normalize
   * @returns Normalized name safe for NATS subjects
   *
   * @example
   * ```typescript
   * Subject.normalizeName('User Created') // 'user_created'
   * Subject.normalizeName('user.created') // 'user.created' (dots preserved)
   * Subject.normalizeName('users.*') // 'users.*' (wildcards preserved)
   * ```
   */
  static normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_.>*-]/g, '_');
  }

  /**
   * Check if a subject pattern matches a concrete subject
   *
   * Supports NATS wildcards:
   * - * matches a single token
   * - > matches one or more tokens (tail wildcard)
   *
   * @param pattern - Subject pattern (may contain wildcards)
   * @param subject - Concrete subject to test
   * @returns true if pattern matches subject
   *
   * @example
   * ```typescript
   * Subject.matches('production.*.created', 'production.user.created') // true
   * Subject.matches('production.>', 'production.myapp.user.created') // true
   * Subject.matches('production.events.*', 'production.events.users') // true
   * Subject.matches('production.events.*', 'production.events.users.user') // false
   * ```
   */
  static matches(pattern: string, subject: string): boolean {
    const patternTokens = pattern.split('.');
    const subjectTokens = subject.split('.');

    let index = 0;

    while (index < patternTokens.length && index < subjectTokens.length) {
      const patternToken = patternTokens[index];

      if (patternToken === '>') {
        // Tail wildcard matches everything remaining
        return true;
      }

      if (patternToken === '*') {
        // Single token wildcard, continue to next token
        index++;
        continue;
      }

      // Exact match required
      if (patternToken !== subjectTokens[index]) {
        return false;
      }

      index++;
    }

    // Exact match or remaining '>' wildcard
    if (index === patternTokens.length && index === subjectTokens.length) {
      return true;
    }

    // Check if pattern has remaining '>' wildcard
    return patternTokens[index] === '>' || patternTokens.slice(index).includes('>');
  }

  /**
   * Validate a subject string
   *
   * Checks if a subject follows valid NATS subject rules:
   * - Not empty
   * - Contains only valid characters (a-z, 0-9, ., -, _, *, >)
   * - Doesn't start or end with a dot
   * - No consecutive dots
   * - Wildcards in valid positions
   *
   * @param subject - Subject string to validate
   * @returns true if subject is valid
   *
   * @example
   * ```typescript
   * Subject.isValid('production.myapp.user') // true
   * Subject.isValid('production..myapp') // false (consecutive dots)
   * Subject.isValid('.production.myapp') // false (starts with dot)
   * Subject.isValid('production.*.user') // true (wildcard valid)
   * ```
   */
  static isValid(subject: string): boolean {
    if (!subject || subject.length === 0) {
      return false;
    }

    // Can't start or end with a dot
    if (subject.startsWith('.') || subject.endsWith('.')) {
      return false;
    }

    // No consecutive dots
    if (subject.includes('..')) {
      return false;
    }

    // Only valid characters: a-z, 0-9, dot, hyphen, underscore, wildcards
    if (!/^[a-z0-9._*>-]+$/i.test(subject)) {
      return false;
    }

    // Tail wildcard (>) must be the last token
    const tokens = subject.split('.');
    const tailIndex = tokens.indexOf('>');
    if (tailIndex !== -1 && tailIndex !== tokens.length - 1) {
      return false;
    }

    return true;
  }
}
