/**
 * Elasticsearch Integration
 * Search and analytics engine integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Elasticsearch-specific configuration
 * @extends IntegrationConfig
 */
export interface ElasticsearchConfig extends IntegrationConfig {
  /** Elasticsearch host */
  host?: string;
  /** Index name */
  index?: string;
  /** Document type */
  type?: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Cloud ID for Elastic Cloud */
  cloudId?: string;
}

/**
 * Elasticsearch integration class
 * @extends BaseIntegration
 */
export class ElasticsearchIntegration extends BaseIntegration {
  private esConfig: Required<ElasticsearchConfig>;

  constructor(config: ElasticsearchConfig = {}) {
    const host = config.host || "http://localhost:9200";
    const index = config.index || "logs";

    super({
      name: "elasticsearch",
      endpoint: `${host}/${index}/_doc`,
      ...config,
    });

    this.esConfig = {
      ...this.config,
      host,
      index,
      type: config.type || "_doc",
      username: config.username || "",
      password: config.password || "",
      cloudId: config.cloudId || "",
    };

    // Override endpoint for Elastic Cloud
    if (this.esConfig.cloudId) {
      const cloudParts = this.esConfig.cloudId.split(":");
      if (cloudParts[1]) {
        const decoded = atob(cloudParts[1]);
        const [domain, uuid] = decoded.split("$");
        this.config.endpoint = `https://${uuid}.${domain}/${this.esConfig.index}/_doc`;
      }
    }
  }

  /** Transform log entry for Elasticsearch */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Elasticsearch-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          elasticsearch: {
            index: this.esConfig.index,
            type: this.esConfig.type,
            host: this.esConfig.host,
          },
        },
      },
    };
  }

  /** Send entries to Elasticsearch */
  protected async send(entries: LogEntry[]): Promise<void> {
    // Use bulk API for better performance
    const bulkBody: string[] = [];

    for (const entry of entries) {
      const doc = this.formatForElasticsearch(entry);

      // Add index action
      bulkBody.push(
        JSON.stringify({
          index: {
            _index: this.esConfig.index,
            _type: this.esConfig.type,
          },
        })
      );

      // Add document
      bulkBody.push(JSON.stringify(doc));
    }

    const bulkEndpoint = `${this.esConfig.host}/_bulk`;
    const headers: Record<string, string> = {
      "Content-Type": "application/x-ndjson",
    };

    // Add authentication headers
    if (this.esConfig.apiKey) {
      headers["Authorization"] = `ApiKey ${this.esConfig.apiKey}`;
    } else if (this.esConfig.username && this.esConfig.password) {
      headers["Authorization"] =
        `Basic ${btoa(`${this.esConfig.username}:${this.esConfig.password}`)}`;
    }

    await this.makeRequest(bulkEndpoint, {
      method: "POST",
      headers,
      body: bulkBody.join("\n") + "\n",
    });
  }

  /** Format log entry for Elasticsearch */

  private formatForElasticsearch(entry: LogEntry): any {
    const esDoc: any = {
      "@timestamp": entry.timestamp.toISOString(),
      level: this.mapLogLevelToElasticsearch(entry.level),
      message: entry.message,
      logger: "logger-elasticsearch-integration",
      environment: this.esConfig.environment,
      ...entry.data,
    };

    // Add context fields
    if (entry.context) {
      esDoc.context = {
        component: entry.context.component,
        operation: entry.context.operation,
        userId: entry.context.userId,
        sessionId: entry.context.sessionId,
        requestId: entry.context.requestId,
        ...entry.context.metadata,
      };

      // Add performance timing if available
      if (entry.context.timing) {
        esDoc.timing = entry.context.timing;
      }
    }

    // Add error information if present
    if (entry.error) {
      esDoc.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
        stackTrace: this.parseStackTrace(entry.error.stack),
      };
    }

    // Add source information if available
    if (entry.source) {
      esDoc.source = entry.source;
    }

    // Add entry ID if available
    if (entry.id) {
      esDoc.logId = entry.id;
    }

    return esDoc;
  }

  /** Map our log levels to Elasticsearch-friendly levels */
  private mapLogLevelToElasticsearch(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.INFO:
        return "info";
      case LogLevel.HTTP:
        return "http";
      case LogLevel.VERBOSE:
        return "verbose";
      case LogLevel.DEBUG:
        return "debug";
      case LogLevel.SILLY:
        return "silly";
      default:
        return "info";
    }
  }

  /** Parse stack trace for structured format */

  private parseStackTrace(stack?: string): any[] {
    if (!stack) return [];

    return stack
      .split("\n")
      .slice(1) // Remove error message line
      .map((line, index) => {
        const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
        if (match && match[1] && match[2] && match[3] && match[4]) {
          return {
            frame: index,
            function: match[1],
            file: match[2],
            line: parseInt(match[3], 10),
            column: parseInt(match[4], 10),
          };
        }
        return {
          frame: index,
          raw: line.trim(),
        };
      })
      .filter((frame) => frame.raw || frame.function);
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.esConfig.host;
  }
}
