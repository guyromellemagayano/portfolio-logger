/**
 * Papertrail Integration
 * Simple log management service integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Papertrail-specific configuration
 * @extends IntegrationConfig
 */
export interface PapertrailConfig extends IntegrationConfig {
  /** Papertrail host */
  host?: string;
  /** Papertrail port */
  port?: number;
  /** Program name */
  program?: string;
  /** Hostname to send */
  hostname?: string;
  /** Facility for syslog */
  facility?: number;
}

/**
 * Papertrail integration class
 * @extends BaseIntegration
 */
export class PapertrailIntegration extends BaseIntegration {
  private papertrailConfig: Required<PapertrailConfig>;

  constructor(config: PapertrailConfig = {}) {
    const host = config.host || "logs.papertrailapp.com";
    const port = config.port || 514;

    super({
      name: "papertrail",
      endpoint: `https://${host}:${port}`, // HTTP endpoint for webhook-style sending
      ...config,
    });

    this.papertrailConfig = {
      ...this.config,
      host,
      port,
      program: config.program || "logger",
      hostname: config.hostname || "logger-host",
      facility: config.facility || 16, // local0
    };
  }

  /** Transform log entry for Papertrail */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Papertrail-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          papertrail: {
            host: this.papertrailConfig.host,
            port: this.papertrailConfig.port,
            program: this.papertrailConfig.program,
          },
        },
      },
    };
  }

  /** Send entries to Papertrail */
  protected async send(entries: LogEntry[]): Promise<void> {
    // For simplicity, we'll send each entry as a separate syslog message
    // In production, you might want to use actual syslog protocol (RFC 3164/5424)

    for (const entry of entries) {
      const syslogMessage = this.formatForPapertrail(entry);

      // Send via HTTP (alternative to UDP syslog)
      await this.sendHttpSyslog(syslogMessage);
    }
  }

  /** Format log entry for Papertrail syslog */
  private formatForPapertrail(entry: LogEntry): string {
    const priority = this.calculatePriority(entry.level);
    const timestamp = this.formatSyslogTimestamp(entry.timestamp);
    const hostname = this.papertrailConfig.hostname;
    const program = this.papertrailConfig.program;

    // Create structured message

    const messageData: any = {
      level: this.mapLogLevelToPapertrail(entry.level),
      message: entry.message,
      logger: "logger-papertrail-integration",
      environment: this.papertrailConfig.environment,
      ...entry.data,
    };

    // Add context fields
    if (entry.context) {
      messageData.context = {
        component: entry.context.component,
        operation: entry.context.operation,
        userId: entry.context.userId,
        sessionId: entry.context.sessionId,
        requestId: entry.context.requestId,
        ...entry.context.metadata,
      };

      // Add performance timing if available
      if (entry.context.timing) {
        messageData.timing = entry.context.timing;
      }
    }

    // Add error information if present
    if (entry.error) {
      messageData.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add source information if available
    if (entry.source) {
      messageData.source = entry.source;
    }

    // Add entry ID if available
    if (entry.id) {
      messageData.logId = entry.id;
    }

    // Format as syslog message (RFC 3164 style)
    const structuredMessage = JSON.stringify(messageData);
    return `<${priority}>${timestamp} ${hostname} ${program}: ${structuredMessage}`;
  }

  /** Send syslog message via HTTP */
  private async sendHttpSyslog(message: string): Promise<void> {
    // This is a simplified HTTP approach
    // For production use, consider using actual UDP syslog protocol

    const endpoint = `${this.config.endpoint}/logs`;

    await this.makeRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: message,
    });
  }

  /** Calculate syslog priority */
  private calculatePriority(level: LogLevel): number {
    const facility = this.papertrailConfig.facility;
    const severity = this.mapLogLevelToSyslogSeverity(level);
    return facility * 8 + severity;
  }

  /** Map our log levels to Papertrail levels */
  private mapLogLevelToPapertrail(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.INFO:
        return "info";
      case LogLevel.HTTP:
        return "info";
      case LogLevel.VERBOSE:
        return "debug";
      case LogLevel.DEBUG:
        return "debug";
      case LogLevel.SILLY:
        return "debug";
      default:
        return "info";
    }
  }

  /** Map our log levels to syslog severity levels */
  private mapLogLevelToSyslogSeverity(level: LogLevel): number {
    switch (level) {
      case LogLevel.ERROR:
        return 3; // Error
      case LogLevel.WARN:
        return 4; // Warning
      case LogLevel.INFO:
      case LogLevel.HTTP:
        return 6; // Informational
      case LogLevel.VERBOSE:
      case LogLevel.DEBUG:
      case LogLevel.SILLY:
        return 7; // Debug
      default:
        return 6; // Informational
    }
  }

  /** Format timestamp for syslog */
  private formatSyslogTimestamp(date: Date): string {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, " ");
    const time = date.toTimeString().split(" ")[0];

    return `${month} ${day} ${time}`;
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.papertrailConfig.host;
  }
}
