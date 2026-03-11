/**
 * New Relic Integration
 * Application performance monitoring integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * New Relic-specific configuration
 * @extends IntegrationConfig
 */
export interface NewRelicConfig extends IntegrationConfig {
  /** New Relic License Key */
  licenseKey?: string;
  /** New Relic Account ID */
  accountId?: string;
  /** Application name */
  applicationName?: string;
  /** EU endpoint flag */
  euEndpoint?: boolean;
}

/**
 * New Relic integration class
 * @extends BaseIntegration
 */
export class NewRelicIntegration extends BaseIntegration {
  private newrelicConfig: Required<NewRelicConfig>;

  constructor(config: NewRelicConfig = {}) {
    const euEndpoint = config.euEndpoint || false;
    const baseUrl = euEndpoint
      ? "https://log-api.eu.newrelic.com"
      : "https://log-api.newrelic.com";

    super({
      name: "newrelic",
      endpoint: `${baseUrl}/log/v1`,
      ...config,
    });

    this.newrelicConfig = {
      ...this.config,
      licenseKey: config.licenseKey || config.apiKey || "",
      accountId: config.accountId || "",
      applicationName: config.applicationName || "unknown-app",
      euEndpoint,
    };
  }

  /** Transform log entry for New Relic */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add New Relic-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          newrelic: {
            applicationName: this.newrelicConfig.applicationName,
            accountId: this.newrelicConfig.accountId,
          },
        },
      },
    };
  }

  /** Send entries to New Relic */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.newrelicConfig.licenseKey) {
      throw new Error("New Relic License Key is required");
    }

    const payload = {
      common: {
        attributes: {
          service: this.newrelicConfig.applicationName,
          environment: this.newrelicConfig.environment,
        },
      },
      logs: entries.map((entry) => this.formatForNewRelic(entry)),
    };

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": this.newrelicConfig.licenseKey,
      },
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for New Relic API */

  private formatForNewRelic(entry: LogEntry): any {
    const nrLevel = this.mapLogLevelToNewRelic(entry.level);

    const logEntry: any = {
      timestamp: entry.timestamp.getTime(),
      level: nrLevel,
      message: entry.message,
      attributes: {
        service: this.newrelicConfig.applicationName,
        environment: this.newrelicConfig.environment,
        logger: "logger-newrelic-integration",
        ...entry.data,
      },
    };

    // Add context attributes
    if (entry.context) {
      if (entry.context.component) {
        logEntry.attributes.component = entry.context.component;
      }
      if (entry.context.operation) {
        logEntry.attributes.operation = entry.context.operation;
      }
      if (entry.context.userId) {
        logEntry.attributes.userId = entry.context.userId;
      }
      if (entry.context.sessionId) {
        logEntry.attributes.sessionId = entry.context.sessionId;
      }
      if (entry.context.requestId) {
        logEntry.attributes.requestId = entry.context.requestId;
      }
      if (entry.context.metadata) {
        Object.assign(logEntry.attributes, entry.context.metadata);
      }
    }

    // Add error information if present
    if (entry.error) {
      logEntry.attributes.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      logEntry.attributes.timing = entry.context.timing;
    }

    return logEntry;
  }

  /** Map our log levels to New Relic levels */
  private mapLogLevelToNewRelic(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "ERROR";
      case LogLevel.WARN:
        return "WARN";
      case LogLevel.INFO:
      case LogLevel.HTTP:
        return "INFO";
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
      case LogLevel.SILLY:
        return "DEBUG";
      default:
        return "INFO";
    }
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.newrelicConfig.licenseKey;
  }
}
