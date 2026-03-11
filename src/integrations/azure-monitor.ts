/**
 * Azure Monitor Integration
 * Microsoft Azure monitoring and logging integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/** Azure Monitor telemetry item structure */
interface AzureMonitorTelemetryItem {
  ver: number;
  name: string;
  time: string;
  iKey: string;
  tags: Record<string, string>;
  data: {
    baseType: string;
    baseData: {
      ver: number;
      message?: string;
      severityLevel?: number;
      properties: Record<string, unknown>;
      exceptions?: Array<{
        typeName: string;
        message: string;
        hasFullStack: boolean;
        stack?: string;
        parsedStack: StackFrame[];
      }>;
    };
  };
}

/** Stack frame structure for Azure Monitor */
interface StackFrame {
  level: number;
  method: string;
  fileName?: string;
  line?: number;
  column?: number;
}

/**
 * Azure Monitor-specific configuration
 * @extends IntegrationConfig
 */
export interface AzureMonitorConfig extends IntegrationConfig {
  /** Application Insights Instrumentation Key */
  instrumentationKey?: string;
  /** Connection string */
  connectionString?: string;
  /** Application name */
  applicationName?: string;
  /** Cloud role name */
  cloudRoleName?: string;
  /** Cloud role instance */
  cloudRoleInstance?: string;
}

/**
 * Azure Monitor integration class
 * @extends BaseIntegration
 */
export class AzureMonitorIntegration extends BaseIntegration {
  private azureConfig: Required<AzureMonitorConfig>;

  constructor(config: AzureMonitorConfig = {}) {
    super({
      name: "azure-monitor",
      endpoint: "https://dc.applicationinsights.azure.com/v2/track",
      ...config,
    });

    this.azureConfig = {
      ...this.config,
      instrumentationKey: config.instrumentationKey || config.apiKey || "",
      connectionString: config.connectionString || "",
      applicationName: config.applicationName || "unknown-app",
      cloudRoleName: config.cloudRoleName || "unknown-role",
      cloudRoleInstance: config.cloudRoleInstance || "unknown-instance",
    };

    // Override endpoint if connection string is provided
    if (this.azureConfig.connectionString) {
      const match = this.azureConfig.connectionString.match(
        /IngestionEndpoint=([^;]+)/
      );
      if (match) {
        this.config.endpoint = `${match[1]}/v2/track`;
      }
    }
  }

  /** Transform log entry for Azure Monitor */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Azure Monitor-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          azureMonitor: {
            instrumentationKey: this.azureConfig.instrumentationKey,
            applicationName: this.azureConfig.applicationName,
            cloudRoleName: this.azureConfig.cloudRoleName,
          },
        },
      },
    };
  }

  /** Send entries to Azure Monitor */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.azureConfig.instrumentationKey) {
      throw new Error("Azure Monitor Instrumentation Key is required");
    }

    const payload = entries.map((entry) => this.formatForAzureMonitor(entry));

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for Azure Monitor API */
  private formatForAzureMonitor(entry: LogEntry): AzureMonitorTelemetryItem {
    const severity = this.mapLogLevelToAzureMonitor(entry.level);

    const telemetryItem: AzureMonitorTelemetryItem = {
      ver: 1,
      name: "Microsoft.ApplicationInsights.Message",
      time: entry.timestamp.toISOString(),
      iKey: this.azureConfig.instrumentationKey,
      tags: {
        "ai.application.ver": "1.0.0",
        "ai.cloud.role": this.azureConfig.cloudRoleName,
        "ai.cloud.roleInstance": this.azureConfig.cloudRoleInstance,
        "ai.internal.sdkVersion": "logger-azure-integration:1.0.0",
      },
      data: {
        baseType: "MessageData",
        baseData: {
          ver: 2,
          message: entry.message,
          severityLevel: severity,
          properties: {
            logger: "logger-azure-integration",
            environment: this.azureConfig.environment,
            ...entry.data,
          },
        },
      },
    };

    // Add context properties
    if (entry.context) {
      if (entry.context.component) {
        telemetryItem.data.baseData.properties.component =
          entry.context.component;
      }
      if (entry.context.operation) {
        telemetryItem.data.baseData.properties.operation =
          entry.context.operation;
      }
      if (entry.context.userId) {
        telemetryItem.tags["ai.user.id"] = entry.context.userId;
        telemetryItem.data.baseData.properties.userId = entry.context.userId;
      }
      if (entry.context.sessionId) {
        telemetryItem.tags["ai.session.id"] = entry.context.sessionId;
        telemetryItem.data.baseData.properties.sessionId =
          entry.context.sessionId;
      }
      if (entry.context.requestId) {
        telemetryItem.tags["ai.operation.id"] = entry.context.requestId;
        telemetryItem.data.baseData.properties.requestId =
          entry.context.requestId;
      }
      if (entry.context.metadata) {
        Object.assign(
          telemetryItem.data.baseData.properties,
          entry.context.metadata
        );
      }
    }

    // Add error information if present
    if (entry.error) {
      telemetryItem.data.baseData.properties.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };

      // Also create an exception telemetry item for errors
      if (entry.level === LogLevel.ERROR) {
        telemetryItem.name = "Microsoft.ApplicationInsights.Exception";
        telemetryItem.data.baseType = "ExceptionData";
        telemetryItem.data.baseData = {
          ver: 2,
          exceptions: [
            {
              typeName: entry.error.name,
              message: entry.error.message,
              hasFullStack: !!entry.error.stack,
              stack: entry.error.stack,
              parsedStack: this.parseStackTrace(entry.error.stack),
            },
          ],
          properties: telemetryItem.data.baseData.properties,
        };
      }
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      telemetryItem.data.baseData.properties.timing = entry.context.timing;
    }

    return telemetryItem;
  }

  /** Map our log levels to Azure Monitor severity levels */
  private mapLogLevelToAzureMonitor(level: LogLevel): number {
    switch (level) {
      case LogLevel.ERROR:
        return 3; // Error
      case LogLevel.WARN:
        return 2; // Warning
      case LogLevel.INFO:
      case LogLevel.HTTP:
        return 1; // Information
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
      case LogLevel.SILLY:
        return 0; // Verbose
      default:
        return 1; // Information
    }
  }

  /** Parse stack trace for Azure Monitor format */
  private parseStackTrace(stack?: string): StackFrame[] {
    if (!stack) return [];

    return stack
      .split("\n")
      .slice(1) // Remove error message line
      .map((line, index) => {
        const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
        if (match && match[3] && match[4]) {
          return {
            level: index,
            method: match[1] || "unknown",
            fileName: match[2] || "unknown",
            line: parseInt(match[3], 10),
            column: parseInt(match[4], 10),
          };
        }
        return {
          level: index,
          method: line.trim(),
        };
      })
      .filter(Boolean);
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return super.isReady() && !!this.azureConfig.instrumentationKey;
  }
}
