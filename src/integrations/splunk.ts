/**
 * Splunk Integration
 * Enterprise logging platform integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Splunk-specific configuration
 * @extends IntegrationConfig
 */
export interface SplunkConfig extends IntegrationConfig {
  /** Splunk HTTP Event Collector token */
  token?: string;
  /** Splunk host */
  host?: string;
  /** Port number */
  port?: number;
  /** Use HTTPS */
  ssl?: boolean;
  /** Source type */
  sourcetype?: string;
  /** Source */
  source?: string;
  /** Index */
  index?: string;
}

/**
 * Splunk integration class
 * @extends BaseIntegration
 */
export class SplunkIntegration extends BaseIntegration {
  private splunkConfig: Required<SplunkConfig>;

  constructor(config: SplunkConfig = {}) {
    const host = config.host || "localhost";
    const port = config.port || 8088;
    const ssl = config.ssl ?? true;
    const protocol = ssl ? "https" : "http";

    super({
      name: "splunk",
      endpoint: `${protocol}://${host}:${port}/services/collector/event`,
      ...config,
    });

    this.splunkConfig = {
      ...this.config,
      token: config.token || config.apiKey || "",
      host,
      port,
      ssl,
      sourcetype: config.sourcetype || "logger",
      source: config.source || "logger-splunk-integration",
      index: config.index || "main",
    };
  }

  /** Transform log entry for Splunk */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Splunk-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          splunk: {
            sourcetype: this.splunkConfig.sourcetype,
            source: this.splunkConfig.source,
            index: this.splunkConfig.index,
          },
        },
      },
    };
  }

  /** Send entries to Splunk */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.splunkConfig.token) {
      throw new Error("Splunk HEC token is required");
    }

    // Splunk can accept multiple events in a single request
    const events = entries.map((entry) => this.formatForSplunk(entry));
    const payload = events.map((event) => JSON.stringify(event)).join("\n");

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Splunk ${this.splunkConfig.token}`,
      },
      body: payload,
    });
  }

  /** Format log entry for Splunk HEC */

  private formatForSplunk(entry: LogEntry): any {
    const splunkEvent: any = {
      time: entry.timestamp.getTime() / 1000, // Splunk expects epoch seconds
      host: "logger-host",
      source: this.splunkConfig.source,
      sourcetype: this.splunkConfig.sourcetype,
      index: this.splunkConfig.index,
      event: {
        level: this.mapLogLevelToSplunk(entry.level),
        message: entry.message,
        logger: "logger-splunk-integration",
        environment: this.splunkConfig.environment,
        ...entry.data,
      },
    };

    // Add context fields
    if (entry.context) {
      splunkEvent.event.context = {
        component: entry.context.component,
        operation: entry.context.operation,
        userId: entry.context.userId,
        sessionId: entry.context.sessionId,
        requestId: entry.context.requestId,
        ...entry.context.metadata,
      };

      // Add performance timing if available
      if (entry.context.timing) {
        splunkEvent.event.timing = entry.context.timing;
      }
    }

    // Add error information if present
    if (entry.error) {
      splunkEvent.event.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add source information if available
    if (entry.source) {
      splunkEvent.event.source_info = entry.source;
    }

    // Add entry ID if available
    if (entry.id) {
      splunkEvent.event.log_id = entry.id;
    }

    return splunkEvent;
  }

  /** Map our log levels to Splunk levels */
  private mapLogLevelToSplunk(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "ERROR";
      case LogLevel.WARN:
        return "WARN";
      case LogLevel.INFO:
        return "INFO";
      case LogLevel.HTTP:
        return "INFO";
      case LogLevel.VERBOSE:
        return "DEBUG";
      case LogLevel.DEBUG:
        return "DEBUG";
      case LogLevel.SILLY:
        return "TRACE";
      default:
        return "INFO";
    }
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.splunkConfig.token;
  }
}
