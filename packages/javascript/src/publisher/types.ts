/**
 * Topic message envelope structure
 */
export interface TopicMessage {
  event_id: string;
  schema_version: number;
  topic: string;
  message_type?: string;
  producer: string;
  occurred_at: string;
  trace_id?: string;
  message: Record<string, unknown>;
  // Domain/resource/action fields (for backward compatibility when using publish())
  domain?: string;
  resource?: string;
  action?: string;
  resource_id?: string;
}

/**
 * Options for topic publishing
 */
export interface TopicPublishOptions {
  event_id?: string;
  occurred_at?: Date;
  trace_id?: string;
  message_type?: string;
  // Domain/resource/action fields (used internally by publish())
  domain?: string;
  resource?: string;
  action?: string;
  resource_id?: string;
}

/**
 * Parameters for domain/resource/action publishing
 */
export interface DomainResourceActionParams {
  domain: string;
  resource: string;
  action: string;
  payload: Record<string, unknown>;
}

/**
 * Parameters for multi-topic publishing
 */
export interface MultiTopicParams {
  topics: string[];
  message: Record<string, unknown>;
}

/**
 * Result of a publish operation
 */
export interface PublishResult {
  success: boolean;
  event_id?: string;
  error?: Error;
}

/**
 * Result of publishing to multiple topics
 */
export interface MultiTopicPublishResult {
  results: Record<string, boolean>;
  successCount: number;
  failureCount: number;
}
