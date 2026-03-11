/**
 * Datadog Integration
 * Application monitoring and logging integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Datadog-specific configuration
 * @extends IntegrationConfig
 */
export interface DatadogConfig extends IntegrationConfig {
  /** Datadog API key */
  apiKey?: string;
  /** Datadog site (e.g., 'datadoghq.com' or 'datadoghq.eu') */
  site?: string;
  /** Service name */
  service?: string;
  /** Version */
  version?: string;
  /** Source */
  source?: string;
  /** Hostname */
  hostname?: string;
}

/**
 * Datadog integration class
 * @extends BaseIntegration
 */
export class DatadogIntegration extends BaseIntegration {
  private datadogConfig: Required<DatadogConfig>;

  constructor(config: DatadogConfig = {}) {
    const site = config.site || "datadoghq.com";
    super({
      name: "datadog",
      endpoint: `https://http-intake.logs.${site}/v1/input/${config.apiKey}`,
      ...config,
    });

    this.datadogConfig = {
      ...this.config,
      site,
      service: config.service || "unknown-service",
      version: config.version || "1.0.0",
      source: config.source || "javascript",
      hostname: config.hostname || "unknown-host",
    };
  }

  /** Transform log entry for Datadog */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Datadog-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          datadog: {
            service: this.datadogConfig.service,
            version: this.datadogConfig.version,
            source: this.datadogConfig.source,
            hostname: this.datadogConfig.hostname,
          },
        },
      },
    };
  }

  /** Send entries to Datadog */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.datadogConfig.apiKey) {
      throw new Error("Datadog API key is required");
    }

    const payload = entries.map((entry) => this.formatForDatadog(entry));

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": this.datadogConfig.apiKey,
      },
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for Datadog API */

  private formatForDatadog(entry: LogEntry): any {
    const ddLevel = this.mapLogLevelToDatadog(entry.level);

    return {
      timestamp: entry.timestamp.toISOString(),
      level: ddLevel,
      message: entry.message,
      service: this.datadogConfig.service,
      version: this.datadogConfig.version,
      source: this.datadogConfig.source,
      hostname: this.datadogConfig.hostname,
      env: this.datadogConfig.environment,
      ddtags: this.formatTags(entry),
      logger: {
        name: "logger-datadog-integration",
        version: "1.0.0",
      },
      // Custom attributes
      ...entry.data,
      context: entry.context,
      error: entry.error
        ? {
            kind: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    };
  }

  /** Map our log levels to Datadog levels */
  private mapLogLevelToDatadog(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.INFO:
      case LogLevel.HTTP:
        return "info";
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
      case LogLevel.SILLY:
        return "debug";
      default:
        return "info";
    }
  }

  /** Format tags for Datadog */
  private formatTags(entry: LogEntry): string {
    const tags: string[] = [];

    // Add context tags
    if (entry.context?.component) {
      tags.push(`component:${entry.context.component}`);
    }
    if (entry.context?.operation) {
      tags.push(`operation:${entry.context.operation}`);
    }
    if (entry.context?.userId) {
      tags.push(`user_id:${entry.context.userId}`);
    }
    if (entry.context?.sessionId) {
      tags.push(`session_id:${entry.context.sessionId}`);
    }
    if (entry.context?.requestId) {
      tags.push(`request_id:${entry.context.requestId}`);
    }

    // Add configured tags
    Object.entries(this.datadogConfig.tags).forEach(([key, value]) => {
      tags.push(`${key}:${value}`);
    });

    return tags.join(",");
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.datadogConfig.apiKey;
  }
}
