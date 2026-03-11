/**
 * Sentry Integration
 * Error tracking and performance monitoring integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Sentry-specific configuration
 * @extends IntegrationConfig
 */
export interface SentryConfig extends IntegrationConfig {
  /** Sentry DSN */
  dsn?: string;
  /** Release version */
  release?: string;
  /** Sample rate for performance monitoring */
  tracesSampleRate?: number;
  /** Environment name */
  environment?: string;
  /** Server name */
  serverName?: string;
}

/**
 * Sentry integration class
 * @extends BaseIntegration
 */
export class SentryIntegration extends BaseIntegration {
  private sentryConfig: Required<SentryConfig>;

  constructor(config: SentryConfig = {}) {
    super({
      name: "sentry",
      endpoint: "https://sentry.io/api/store/",
      ...config,
    });

    this.sentryConfig = {
      ...this.config,
      dsn: config.dsn || config.apiKey || "",
      release: config.release || "unknown",
      tracesSampleRate: config.tracesSampleRate ?? 0.1,
      serverName: config.serverName || "unknown",
    };
  }

  /** Transform log entry for Sentry */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Sentry-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          sentry: {
            level: this.mapLogLevelToSentry(entry.level),
            release: this.sentryConfig.release,
            environment: this.sentryConfig.environment,
            serverName: this.sentryConfig.serverName,
          },
        },
      },
    };
  }

  /** Send entries to Sentry */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.sentryConfig.dsn) {
      throw new Error("Sentry DSN is required");
    }

    for (const entry of entries) {
      await this.sendToSentry(entry);
    }
  }

  /** Send individual entry to Sentry */
  private async sendToSentry(entry: LogEntry): Promise<void> {
    const sentryPayload = this.formatForSentry(entry);
    const endpoint = this.getSentryEndpoint();

    await this.makeRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": this.getSentryAuth(),
      },
      body: JSON.stringify(sentryPayload),
    });
  }

  /** Format log entry for Sentry API */

  private formatForSentry(entry: LogEntry): any {
    const sentryLevel = this.mapLogLevelToSentry(entry.level);

    const payload: any = {
      event_id: entry.id || this.generateEventId(),
      timestamp: entry.timestamp.toISOString(),
      level: sentryLevel,
      platform: "javascript",
      sdk: {
        name: "logger-sentry-integration",
        version: "1.0.0",
      },
      environment: this.sentryConfig.environment,
      release: this.sentryConfig.release,
      server_name: this.sentryConfig.serverName,
      message: {
        formatted: entry.message,
      },
      extra: {
        ...entry.data,
        ...entry.context?.metadata,
      },
      tags: Object.fromEntries(
        Object.entries({
          component: entry.context?.component,
          operation: entry.context?.operation,
          userId: entry.context?.userId,
          sessionId: entry.context?.sessionId,
          requestId: entry.context?.requestId,
        }).filter(([, value]) => value != null)
      ),
    };

    // Add error information if present
    if (entry.error) {
      payload.exception = {
        values: [
          {
            type: entry.error.name,
            value: entry.error.message,
            stacktrace: {
              frames: this.parseStackTrace(entry.error.stack),
            },
          },
        ],
      };
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      payload.extra.timing = entry.context.timing;
    }

    return payload;
  }

  /** Get Sentry API endpoint */
  private getSentryEndpoint(): string {
    const dsn = new URL(this.sentryConfig.dsn);
    const projectId = dsn.pathname.substring(1);
    return `${dsn.protocol}//${dsn.host}/api/${projectId}/store/`;
  }

  /** Get Sentry authentication header */
  private getSentryAuth(): string {
    const dsn = new URL(this.sentryConfig.dsn);
    const sentryKey = dsn.username || "";
    return [
      "Sentry sentry_version=7",
      `sentry_client=logger-sentry-integration/1.0.0`,
      `sentry_timestamp=${Math.floor(Date.now() / 1000)}`,
      `sentry_key=${sentryKey}`,
    ].join(", ");
  }

  /** Map our log levels to Sentry levels */
  private mapLogLevelToSentry(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warning";
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

  /** Parse stack trace for Sentry format */

  private parseStackTrace(stack?: string): any[] {
    if (!stack) return [];

    return stack
      .split("\n")
      .slice(1) // Remove error message line
      .map((line) => {
        const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
        if (match && match[1] && match[2] && match[3] && match[4]) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3], 10),
            colno: parseInt(match[4], 10),
          };
        }
        return { function: line.trim() };
      })
      .filter(Boolean);
  }

  /** Generate Sentry event ID */
  private generateEventId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.sentryConfig.dsn;
  }
}
