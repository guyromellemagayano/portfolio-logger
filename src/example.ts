/**
 * Logger Integrations Example
 * Demonstrates how to use all available integrations
 */

import {
  createLogger,
  integrations,
  LogLevel,
  type Transport,
  transports,
} from ".";

// Example: Production Logger with Multiple Integrations
export function createProductionLogger() {
  return createLogger({
    level: LogLevel.INFO,
    environment: "production",
    transports: [
      // Error tracking and monitoring
      integrations.sentry({
        dsn: process.env.SENTRY_DSN || "https://example@sentry.io/123",
        environment: "production",
        release: "1.0.0",
        enabled: !!process.env.SENTRY_DSN,
      }),

      // APM and application monitoring
      integrations.datadog({
        apiKey: process.env.DATADOG_API_KEY || "demo-key",
        service: "my-application",
        environment: "production",
        enabled: !!process.env.DATADOG_API_KEY,
      }),

      // Performance monitoring
      integrations.newrelic({
        licenseKey: process.env.NEWRELIC_LICENSE_KEY || "demo-key",
        applicationName: "My Application",
        enabled: !!process.env.NEWRELIC_LICENSE_KEY,
      }),

      // Session replay for frontend issues
      integrations.logrocket({
        apiToken: process.env.LOGROCKET_TOKEN || "demo-token",
        appId: process.env.LOGROCKET_APP_ID || "demo-app",
        enabled: !!process.env.LOGROCKET_TOKEN,
      }),
    ],
  });
}

// Example: Cloud Logger with Provider-Specific Integrations
export function createCloudLogger() {
  return createLogger({
    level: LogLevel.DEBUG,
    transports: [
      // AWS CloudWatch for AWS deployments
      integrations.cloudwatch({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "demo-key",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "demo-secret",
        region: process.env.AWS_REGION || "us-east-1",
        logGroupName: "/aws/lambda/my-function",
        enabled: !!(
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ),
      }),

      // Google Cloud Logging for GCP deployments
      integrations.googleCloud({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "demo-project",
        keyFile: process.env.GOOGLE_CLOUD_KEY_FILE || "{}",
        logName: "application-logs",
        enabled: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      }),

      // Azure Monitor for Azure deployments
      integrations.azureMonitor({
        instrumentationKey: process.env.AZURE_INSTRUMENTATION_KEY || "demo-key",
        applicationName: "My Azure App",
        enabled: !!process.env.AZURE_INSTRUMENTATION_KEY,
      }),
    ],
  });
}

// Example: Analytics and Search Logger
export function createAnalyticsLogger() {
  return createLogger({
    level: LogLevel.VERBOSE,
    transports: [
      // Elasticsearch for search and analytics
      integrations.elasticsearch({
        host: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
        index: `logs-${new Date().toISOString().split("T")[0]}`, // Daily indices
        apiKey: process.env.ELASTICSEARCH_API_KEY,
        enabled: !!process.env.ELASTICSEARCH_URL,
        batch: {
          size: 100,
          flushInterval: 5000,
        },
      }),

      // Splunk for enterprise logging
      integrations.splunk({
        token: process.env.SPLUNK_HEC_TOKEN || "demo-token",
        host: process.env.SPLUNK_HOST || "localhost",
        port: parseInt(process.env.SPLUNK_PORT || "8088"),
        enabled: !!process.env.SPLUNK_HEC_TOKEN,
      }),

      // Papertrail for simple log management
      integrations.papertrail({
        host: process.env.PAPERTRAIL_HOST || "logs.papertrailapp.com",
        port: parseInt(process.env.PAPERTRAIL_PORT || "514"),
        program: "my-app",
        enabled: !!process.env.PAPERTRAIL_PORT,
      }),
    ],
  });
}

// Example: Development Logger
export function createDevelopmentLogger() {
  return createLogger({
    level: LogLevel.SILLY,
    transports: [
      // Console for local development
      transports.console,

      // Optional: Local Elasticsearch for testing
      ...(process.env.LOCAL_ELASTICSEARCH
        ? [
            integrations.elasticsearch({
              host: "http://localhost:9200",
              index: "dev-logs",
            }),
          ]
        : []),
    ],
  });
}

// Example: Adaptive Logger Based on Environment
export function createAdaptiveLogger() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";
  const isStaging = process.env.NODE_ENV === "staging";

  const loggerTransports: Transport[] = [
    // Always include console in non-production
    ...(isDevelopment ? [transports.console] : []),
  ];

  // Add production integrations
  if (isProduction) {
    // Critical error tracking
    if (process.env.SENTRY_DSN) {
      loggerTransports.push(
        integrations.sentry({
          dsn: process.env.SENTRY_DSN,
          environment: "production",
        })
      );
    }

    // Performance monitoring
    if (process.env.DATADOG_API_KEY) {
      loggerTransports.push(
        integrations.datadog({
          apiKey: process.env.DATADOG_API_KEY,
          service: "production-app",
          environment: "production",
        })
      );
    }

    // Long-term storage
    if (process.env.ELASTICSEARCH_URL) {
      loggerTransports.push(
        integrations.elasticsearch({
          host: process.env.ELASTICSEARCH_URL,
          index: "production-logs",
          batch: { size: 50, flushInterval: 10000 },
        })
      );
    }
  }

  // Add staging integrations
  if (isStaging) {
    loggerTransports.push(
      integrations.sentry({
        dsn: process.env.SENTRY_DSN || "",
        environment: "staging",
        enabled: !!process.env.SENTRY_DSN,
      })
    );
  }

  return createLogger({
    level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,

    environment: (process.env.NODE_ENV as any) || "development",
    transports: loggerTransports,
  });
}

// Example Usage Demonstration
export function demonstrateIntegrations() {
  console.log("🚀 Logger Integrations Demo\n");

  // Create adaptive logger
  const logger = createAdaptiveLogger();

  // Create child logger with context
  const requestLogger = logger.child({
    requestId: "req-123456",
    userId: "user-789",
    component: "auth-service",
  });

  // Log different types of messages
  requestLogger.info("User authentication started", {
    email: "user@example.com",
    timestamp: new Date().toISOString(),
  });

  requestLogger.warn("Rate limit approaching", {
    currentRequests: 95,
    limit: 100,
    timeWindow: "1m",
  });

  requestLogger.error(
    "Authentication failed",
    new Error("Invalid credentials"),
    {
      metadata: {
        attemptCount: 3,
        ipAddress: "192.168.1.100",
      },
    }
  );

  // Performance timing example
  logger.time("database-query");
  setTimeout(() => {
    logger.timeEnd("database-query");
    logger.info("Database query completed", {
      query: "SELECT * FROM users WHERE active = true",
      resultCount: 150,
    });
  }, 100);

  // Metrics example
  logger.counter("user.login.attempts", 1, { success: "false" });
  logger.gauge("memory.usage", 85.5, { unit: "percent" });
  logger.histogram("response.time", 250, { endpoint: "/api/auth" });

  console.log(
    "\n✅ Demo completed! Check your configured integrations for log data."
  );
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateIntegrations();
}
