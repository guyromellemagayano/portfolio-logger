/**
 * Google Cloud Logging Integration
 * Google Cloud Platform logging service integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * Google Cloud-specific configuration
 * @extends IntegrationConfig
 */
export interface GoogleCloudConfig extends IntegrationConfig {
  /** Google Cloud Project ID */
  projectId?: string;
  /** Service Account Key (JSON) */
  keyFile?: string;
  /** Log name */
  logName?: string;
  /** Resource type */
  resourceType?: string;
  /** Resource labels */
  resourceLabels?: Record<string, string>;
}

/**
 * Google Cloud integration class
 * @extends BaseIntegration
 */
export class GoogleCloudIntegration extends BaseIntegration {
  private gcpConfig: Required<GoogleCloudConfig>;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(config: GoogleCloudConfig = {}) {
    super({
      name: "google-cloud",
      endpoint: `https://logging.googleapis.com/v2/entries:write`,
      ...config,
    });

    this.gcpConfig = {
      ...this.config,
      projectId: config.projectId || "",
      keyFile: config.keyFile || config.apiKey || "",
      logName: config.logName || "application",
      resourceType: config.resourceType || "global",
      resourceLabels: config.resourceLabels || {},
    };
  }

  /** Transform log entry for Google Cloud */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add Google Cloud-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          googleCloud: {
            projectId: this.gcpConfig.projectId,
            logName: this.gcpConfig.logName,
            resourceType: this.gcpConfig.resourceType,
          },
        },
      },
    };
  }

  /** Send entries to Google Cloud Logging */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (!this.gcpConfig.keyFile || !this.gcpConfig.projectId) {
      throw new Error("Google Cloud credentials and project ID are required");
    }

    // Ensure we have a valid access token
    await this.ensureAccessToken();

    const payload = {
      entries: entries.map((entry) => this.formatForGoogleCloud(entry)),
    };

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for Google Cloud API */

  private formatForGoogleCloud(entry: LogEntry): any {
    const severity = this.mapLogLevelToGoogleCloud(entry.level);

    const logEntry: any = {
      logName: `projects/${this.gcpConfig.projectId}/logs/${this.gcpConfig.logName}`,
      resource: {
        type: this.gcpConfig.resourceType,
        labels: this.gcpConfig.resourceLabels,
      },
      timestamp: entry.timestamp.toISOString(),
      severity,
      textPayload: entry.message,
      labels: {},
      jsonPayload: {
        logger: "logger-googlecloud-integration",
        environment: this.gcpConfig.environment,
        ...entry.data,
      },
    };

    // Add context labels
    if (entry.context?.component) {
      logEntry.labels.component = entry.context.component;
    }
    if (entry.context?.operation) {
      logEntry.labels.operation = entry.context.operation;
    }
    if (entry.context?.userId) {
      logEntry.labels.userId = entry.context.userId;
    }
    if (entry.context?.sessionId) {
      logEntry.labels.sessionId = entry.context.sessionId;
    }
    if (entry.context?.requestId) {
      logEntry.labels.requestId = entry.context.requestId;
    }

    // Add error information if present
    if (entry.error) {
      logEntry.jsonPayload.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      logEntry.jsonPayload.timing = entry.context.timing;
    }

    // Add context metadata
    if (entry.context?.metadata) {
      Object.assign(logEntry.jsonPayload, entry.context.metadata);
    }

    return logEntry;
  }

  /** Map our log levels to Google Cloud severity */
  private mapLogLevelToGoogleCloud(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return "ERROR";
      case LogLevel.WARN:
        return "WARNING";
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

  /** Ensure valid access token */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    try {
      const serviceAccount = JSON.parse(this.gcpConfig.keyFile);
      const token = await this.getAccessToken(serviceAccount);
      this.accessToken = token.access_token;
      this.tokenExpiry = Date.now() + (token.expires_in - 60) * 1000; // 60s buffer
    } catch (error) {
      throw new Error(`Failed to get Google Cloud access token: ${error}`);
    }
  }

  /** Get access token using service account */

  private async getAccessToken(serviceAccount: any): Promise<any> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/logging.write",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Create JWT
    const header = { alg: "RS256", typ: "JWT" };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key (simplified - would need proper RSA signing in production)
    const signature = btoa(`signature_placeholder_${unsignedToken}`);
    const jwt = `${unsignedToken}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return (
      super.isReady() && !!this.gcpConfig.keyFile && !!this.gcpConfig.projectId
    );
  }
}
