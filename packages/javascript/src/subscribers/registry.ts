import { Subscriber } from '../types';

/**
 * Registry manages subscriber registration and lookup
 *
 * Responsibilities:
 * - Register subscribers for subjects
 * - Retrieve subscribers for a subject
 * - Get list of all registered subjects
 */
export class Registry {
  private subscribers: Map<string, Subscriber[]> = new Map();

  /**
   * Register a subscriber for one or more subjects
   *
   * @param subscriber - Subscriber instance to register
   */
  register(subscriber: Subscriber): void {
    for (const subject of subscriber.subjects) {
      if (!this.subscribers.has(subject)) {
        this.subscribers.set(subject, []);
      }
      this.subscribers.get(subject)!.push(subscriber);
    }
  }

  /**
   * Get all subscribers registered for a specific subject
   *
   * @param subject - Subject to look up
   * @returns Array of subscribers for the subject (empty if none)
   */
  getSubscribers(subject: string): Subscriber[] {
    return this.subscribers.get(subject) || [];
  }

  /**
   * Get all registered subjects
   *
   * @returns Array of all subject strings
   */
  getAllSubjects(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Check if a subject has registered subscribers
   *
   * @param subject - Subject to check
   * @returns true if subject has subscribers
   */
  hasSubscribers(subject: string): boolean {
    const subs = this.subscribers.get(subject);
    return subs !== undefined && subs.length > 0;
  }

  /**
   * Get total number of registered subscribers across all subjects
   *
   * @returns Total subscriber count
   */
  getTotalCount(): number {
    let count = 0;
    for (const subs of this.subscribers.values()) {
      count += subs.length;
    }
    return count;
  }

  /**
   * Clear all registered subscribers
   */
  clear(): void {
    this.subscribers.clear();
  }
}
