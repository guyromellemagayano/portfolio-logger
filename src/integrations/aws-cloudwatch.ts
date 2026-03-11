/**
 * AWS CloudWatch Integration
 * Cloud logging service integration
 */

import { type LogEntry, LogLevel } from "../types";
import { BaseIntegration, type IntegrationConfig } from "./base";

/**
 * AWS CloudWatch-specific configuration
 * @extends IntegrationConfig
 */
export interface CloudWatchConfig extends IntegrationConfig {
  /** AWS Access Key ID */
  accessKeyId?: string;
  /** AWS Secret Access Key */
  secretAccessKey?: string;
  /** AWS Region */
  region?: string;
  /** CloudWatch Log Group name */
  logGroupName?: string;
  /** CloudWatch Log Stream name */
  logStreamName?: string;
  /** Session token for temporary credentials */
  sessionToken?: string;
}

/** CloudWatch log event structure */
interface CloudWatchLogEvent {
  timestamp: number;
  message: string;
}

/** CloudWatch log message structure */
interface CloudWatchLogMessage {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  environment?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  timing?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * AWS CloudWatch integration class
 * @extends BaseIntegration
 */
export class CloudWatchIntegration extends BaseIntegration {
  private cloudwatchConfig: Required<CloudWatchConfig>;

  constructor(config: CloudWatchConfig = {}) {
    const region = config.region || "us-east-1";
    super({
      name: "cloudwatch",
      endpoint: `https://logs.${region}.amazonaws.com/`,
      ...config,
    });

    this.cloudwatchConfig = {
      ...this.config,
      accessKeyId: config.accessKeyId || config.apiKey || "",
      secretAccessKey: config.secretAccessKey || "",
      region,
      logGroupName: config.logGroupName || "/aws/lambda/default",
      logStreamName:
        config.logStreamName ||
        `${new Date().toISOString().split("T")[0]}-${Date.now()}`,
      sessionToken: config.sessionToken || "",
    };
  }

  /** Transform log entry for CloudWatch */
  protected async transform(entry: LogEntry): Promise<LogEntry> {
    const transformed = await super.transform(entry);

    // Add CloudWatch-specific context
    return {
      ...transformed,
      context: {
        ...transformed.context,
        metadata: {
          ...transformed.context?.metadata,
          cloudwatch: {
            logGroup: this.cloudwatchConfig.logGroupName,
            logStream: this.cloudwatchConfig.logStreamName,
            region: this.cloudwatchConfig.region,
          },
        },
      },
    };
  }

  /** Send entries to CloudWatch */
  protected async send(entries: LogEntry[]): Promise<void> {
    if (
      !this.cloudwatchConfig.accessKeyId ||
      !this.cloudwatchConfig.secretAccessKey
    ) {
      throw new Error("AWS credentials are required");
    }

    const logEvents = entries.map((entry) => this.formatForCloudWatch(entry));

    const payload = {
      logGroupName: this.cloudwatchConfig.logGroupName,
      logStreamName: this.cloudwatchConfig.logStreamName,
      logEvents,
    };

    const headers = await this.createAWSHeaders(
      "PutLogEvents",
      JSON.stringify(payload)
    );

    await this.makeRequest(this.config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  /** Format log entry for CloudWatch API */
  private formatForCloudWatch(entry: LogEntry): CloudWatchLogEvent {
    const logMessage: CloudWatchLogMessage = {
      level: this.mapLogLevelToCloudWatch(entry.level),
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      requestId: entry.context?.requestId,
      userId: entry.context?.userId,
      sessionId: entry.context?.sessionId,
      component: entry.context?.component,
      operation: entry.context?.operation,
      environment: this.cloudwatchConfig.environment,
      ...entry.data,
    };

    // Add error information if present
    if (entry.error) {
      logMessage.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    // Add performance timing if available
    if (entry.context?.timing) {
      logMessage.timing = entry.context.timing;
    }

    return {
      timestamp: entry.timestamp.getTime(),
      message: JSON.stringify(logMessage),
    };
  }

  /** Map our log levels to CloudWatch levels */
  private mapLogLevelToCloudWatch(level: LogLevel): string {
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

  /** Create AWS authentication headers */
  private async createAWSHeaders(
    action: string,
    payload: string
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substr(0, 8);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `Logs_20140328.${action}`,
      "X-Amz-Date": amzDate,
      Host: `logs.${this.cloudwatchConfig.region}.amazonaws.com`,
    };

    // Add session token if available
    if (this.cloudwatchConfig.sessionToken) {
      headers["X-Amz-Security-Token"] = this.cloudwatchConfig.sessionToken;
    }

    // Create AWS Signature Version 4
    const signature = await this.createAWSSignature(
      "POST",
      "/",
      "",
      headers,
      payload,
      amzDate,
      dateStamp
    );

    headers["Authorization"] = [
      `AWS4-HMAC-SHA256 Credential=${this.cloudwatchConfig.accessKeyId}/${dateStamp}/${this.cloudwatchConfig.region}/logs/aws4_request`,
      `SignedHeaders=${Object.keys(headers)
        .map((h) => h.toLowerCase())
        .sort()
        .join(";")}`,
      `Signature=${signature}`,
    ].join(", ");

    return headers;
  }

  /** Create AWS Signature Version 4 */
  private async createAWSSignature(
    method: string,
    uri: string,
    queryString: string,
    headers: Record<string, string>,
    payload: string,
    amzDate: string,
    dateStamp: string
  ): Promise<string> {
    // This is a simplified implementation
    // In a real-world scenario, you'd want to use the official AWS SDK
    // or a proper AWS signature library
    const canonicalHeaders = Object.keys(headers)
      .map((key) => key.toLowerCase())
      .sort()
      .map(
        (key) =>
          `${key}:${headers[Object.keys(headers).find((h) => h.toLowerCase() === key)!]}\n`
      )
      .join("");

    const signedHeaders = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .sort()
      .join(";");

    const payloadHash = await this.sha256(payload);
    const canonicalRequest = [
      method,
      uri,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.cloudwatchConfig.region}/logs/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      await this.sha256(canonicalRequest),
    ].join("\n");

    const signingKey = await this.getSignatureKey(
      this.cloudwatchConfig.secretAccessKey
    );

    return await this.hmacSha256Hex(signingKey, stringToSign);
  }

  /** SHA256 hash function */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** HMAC SHA256 function */

  private async hmacSha256Hex(key: any, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signature = await crypto.subtle.sign("HMAC", key as any, dataBuffer);
    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Get AWS signature key */
  private async getSignatureKey(key: string): Promise<any> {
    const kDate = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(`AWS4${key}`),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // This is a simplified version - real AWS signing is more complex
    // In a full implementation, dateStamp, regionName, and serviceName would be used
    return kDate;
  }

  /** Check if integration is ready */
  isReady(): boolean {
    return (
      super.isReady() &&
      !!this.cloudwatchConfig.accessKeyId &&
      !!this.cloudwatchConfig.secretAccessKey
    );
  }
}
