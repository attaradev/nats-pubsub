import { EventMetadata, Subscriber, SubscriberOptions } from './types';

/**
 * Decorator for creating subscriber classes
 */
export function subscriber(subjects: string | string[], options?: SubscriberOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(constructor: T) {
    const subjectArray = Array.isArray(subjects) ? subjects : [subjects];

    return class extends constructor implements Subscriber {
      subjects = subjectArray;
      options = options;

      async call(_event: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
        // This will be overridden by the actual implementation
        throw new Error('Subscriber must implement call() method');
      }
    };
  };
}

/**
 * Base class for subscribers
 */
export abstract class BaseSubscriber implements Subscriber {
  subjects: string[] = [];
  options?: SubscriberOptions;

  constructor(subjects: string | string[], options?: SubscriberOptions) {
    this.subjects = Array.isArray(subjects) ? subjects : [subjects];
    this.options = options;
  }

  abstract call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void>;
}
