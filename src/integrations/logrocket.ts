/**
 * LogRocket Integration
 * Session replay and logging integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * LogRocket-specific configuration
 * @extends IntegrationConfig
 */
export interface LogRocketConfig extends IntegrationConfig {
  /** LogRocket API token */
  apiToken?: string;
  /** LogRocket App ID */
  appId?: string;
  /** Include session URL in logs */
  includeSessionUrl?: boolean;
  /** Custom session properties */

  sessionProperties?: Record<string, any>;
}

/**
 * LogRocket integration class
 * @extends BaseIntegration
 */
export class LogRocketIntegration extends BaseIntegration {
  private logrocketConfig: Required<LogRocketConfig>;

  constructor(config: LogRocketConfig = {}) {
    super({
      name: "logrocket",
      endpoint: "https://r.lr-in.com/api/logs",
      ...config,
    });

    this.logrocketConfig = {
      ...this.config,
      apiToken: config.apiToken || config.apiKey || "",
      appId: config.appId || "",
      includeSessionUrl: config.includeSessionUrl ?? true,
      sessionProperties: config.sessionProperties || {},
    };
  }

  /** Transform log entry for LogRocket */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add LogRocket-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          logrocket: {
            appId: this.logrocketConfig.appId,
            sessionProperties: this.logrocketConfig.sessionProperties,
          },
        },
      },
    };
  }

  /** Send entries to LogRocket */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.logrocketConfig.apiToken) {
      throw new Error("LogRocket API token is required");
    }

    const payload = {
      logs: entries.map((entry) => this.formatForLogRocket(entry)),
    };

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.logrocketConfig.apiToken}`,
        "X-LogRocket-AppId": this.logrocketConfig.appId,
      },
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for LogRocket API */

  private formatForLogRocket(entry: LogEntry): any {
    const lrLevel = this.mapLogLevelToLogRocket(entry.level);

    const logEntry: any = {
      timestamp: entry.timestamp.toISOString(),
      level: lrLevel,
      message: entry.message,
      appId: this.logrocketConfig.appId,
      environment: this.logrocketConfig.environment,
      extra: {
        logger: "logger-logrocket-integration",
        ...entry.data,
        ...this.logrocketConfig.sessionProperties,
      },
    };

    // Add context information
    if (entry.context) {
      logEntry.extra.context = {
        component: entry.context.component,
        operation: entry.context.operation,
        userId: entry.context.userId,
        sessionId: entry.context.sessionId,
        requestId: entry.context.requestId,
        ...entry.context.metadata,
      };
    }

    // Add error information if present
    if (entry.error) {
      logEntry.extra.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      logEntry.extra.timing = entry.context.timing;
    }

    // Add session URL if available and enabled
    if (this.logrocketConfig.includeSessionUrl && entry.context?.sessionId) {
      logEntry.extra.sessionUrl = this.generateSessionUrl(
        entry.context.sessionId
      );
    }

    return logEntry;
  }

  /** Map our log levels to LogRocket levels */
  private mapLogLevelToLogRocket(level: LogLevel): string {
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

  /** Generate LogRocket session URL */
  private generateSessionUrl(sessionId: string): string {
    if (!this.logrocketConfig.appId) {
      return "";
    }
    return `https://app.logrocket.com/${this.logrocketConfig.appId}/sessions/${sessionId}`;
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return (
      super.isReady() &&
      !!this.logrocketConfig.apiToken &&
      !!this.logrocketConfig.appId
    );
  }
}
