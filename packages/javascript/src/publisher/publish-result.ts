import { MultiTopicPublishResult } from './types';

/**
 * PublishResultBuilder - Helps construct and manage publish results
 *
 * Provides utility methods for building publish result objects with
 * proper structure and statistics.
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages publish results
 * - Open/Closed: Easy to extend with new result types
 */
export class PublishResultBuilder {
  /**
   * Create a multi-topic publish result from individual results
   *
   * @param results - Map of topic to success boolean
   * @returns Multi-topic publish result with statistics
   */
  static fromTopicResults(results: Record<string, boolean>): MultiTopicPublishResult {
    const successCount = Object.values(results).filter((success) => success).length;
    const failureCount = Object.values(results).length - successCount;

    return {
      results,
      successCount,
      failureCount,
    };
  }

  /**
   * Create an empty multi-topic result
   *
   * @returns Empty multi-topic publish result
   */
  static createEmpty(): MultiTopicPublishResult {
    return {
      results: {},
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * Check if all topics published successfully
   *
   * @param result - Multi-topic publish result
   * @returns True if all topics published successfully
   */
  static isAllSuccess(result: MultiTopicPublishResult): boolean {
    return result.failureCount === 0;
  }

  /**
   * Check if any topics published successfully
   *
   * @param result - Multi-topic publish result
   * @returns True if at least one topic published successfully
   */
  static hasAnySuccess(result: MultiTopicPublishResult): boolean {
    return result.successCount > 0;
  }

  /**
   * Get list of successful topics
   *
   * @param result - Multi-topic publish result
   * @returns Array of successful topic names
   */
  static getSuccessfulTopics(result: MultiTopicPublishResult): string[] {
    return Object.entries(result.results)
      .filter(([, success]) => success)
      .map(([topic]) => topic);
  }

  /**
   * Get list of failed topics
   *
   * @param result - Multi-topic publish result
   * @returns Array of failed topic names
   */
  static getFailedTopics(result: MultiTopicPublishResult): string[] {
    return Object.entries(result.results)
      .filter(([, success]) => !success)
      .map(([topic]) => topic);
  }
}
