/**
 * Base Integration Class
 * Provides common functionality for all logger integrations
 */

import type { LogEntry, Transport } from "../types";

/** Base configuration for all integrations */
export interface IntegrationConfig {
  /** Integration name */
  name?: string;
  /** API key or token */
  apiKey?: string;
  /** Endpoint URL */
  endpoint?: string;
  /** Environment */
  environment?: string;
  /** Additional tags */
  tags?: Record<string, string>;
  /** Enable/disable integration */
  enabled?: boolean;
  /** Batch configuration */
  batch?: {
    size: number;
    flushInterval: number;
  };
  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
  };
  /** Debug mode */
  debug?: boolean;
}

/**
 * Base integration class
 * @implements Transport
 */
export abstract class BaseIntegration implements Transport {
  public readonly name: string;
  protected config: Required<IntegrationConfig>;
  protected buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: IntegrationConfig = {}) {
    this.name = config.name || this.constructor.name;
    this.config = {
      name: this.name,
      apiKey: config.apiKey || "",
      endpoint: config.endpoint || "",
      environment: config.environment || "production",
      tags: config.tags || {},
      enabled: config.enabled ?? true,
      batch: {
        size: config.batch?.size || 10,
        flushInterval: config.batch?.flushInterval || 5000,
      },
      retry: {
        attempts: config.retry?.attempts || 3,
        delay: config.retry?.delay || 1000,
      },
      debug: config.debug ?? false,
    };

    // Start flush timer if batching is enabled
    if (this.config.batch.size > 1) {
      this.startFlushTimer();
    }
  }

  /** Write log entry (implements Transport interface) */
  async write(entry: LogEntry): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Transform entry for this integration
      const transformedEntry = await this.transform(entry);

      if (this.config.batch.size > 1) {
        // Add to buffer for batching
        this.buffer.push(transformedEntry);

        // Flush if buffer is full
        if (this.buffer.length >= this.config.batch.size) {
          await this.flush();
        }
      } else {
        // Send immediately
        await this.send([transformedEntry]);
      }
    } catch (error) {
      this.handleError(error as Error, entry);
    }
  }

  /** Transform log entry for this integration */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    // Add integration-specific tags
    const transformedEntry: LogEntry = {
      ...entry,
      context: {
        ...entry.context,
        metadata: {
          ...entry.context?.metadata,
          ...this.config.tags,
          integration: this.name,
        },
      },
    };

    return transformedEntry;
  }

  /** Send log entries to the integration */
  protected abstract send(entries: LogEntry[]): Promise<void>;

  /** Flush buffered entries */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.send(entries);
    } catch (error) {
      this.handleError(error as Error);
      // Re-add failed entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  /** Close integration and cleanup */
  async close(): Promise<void> {
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining entries
    await this.flush();
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  /** Handle integration errors */
  protected handleError(error: Error, entry?: LogEntry): void {
    if (this.config.debug) {
      console.error(`[${this.name}] Integration error:`, error, entry);
    }

    // Emit error event if supported
    if (this.onError) {
      this.onError(error);
    }
  }

  /** Error handler (optional) */
  onError?(error: Error): void;

  /** Start flush timer for batching */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.batch.flushInterval);

    // Prevent timer from keeping process alive
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /** Make HTTP request with retry logic */
  protected async makeRequest(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const { timeout = 5000, ...requestOptions } = options;

    for (let attempt = 1; attempt <= this.config.retry.attempts; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        if (attempt === this.config.retry.attempts) {
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retry.delay * attempt)
        );
      }
    }

    throw new Error("Max retry attempts exceeded");
  }
}

/** Create integration factory */
export function createIntegration<T extends BaseIntegration>(
  IntegrationClass: new (config?: IntegrationConfig) => T,
  config?: IntegrationConfig
): T {
  return new IntegrationClass(config);
}
