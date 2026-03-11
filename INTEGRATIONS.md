# Logger Integrations

This package provides comprehensive integrations with popular logging services and
platforms. Each integration is designed to work seamlessly with our universal logger
system while preserving the specific features and capabilities of each service.

> **📖 For basic logger setup and core features, see the [README.md](./README.md)**

## Quick Start

```typescript
import { createLogger, integrations } from '@portfolio/logger';

const logger = createLogger({
  transports: [
    integrations.sentry({ dsn: 'your-sentry-dsn' }),
    integrations.datadog({ apiKey: 'your-datadog-key' }),
  ]
});

logger.error('Something went wrong', new Error('Details'));
```

## Available Integrations

### Core Monitoring Services

#### Sentry (Error Tracking)

```typescript
import { SentryIntegration } from '@portfolio/logger';

const sentryTransport = new SentryIntegration({
  dsn: 'https://your-sentry-dsn@sentry.io/project-id',
  environment: 'production',
  release: '1.0.0',
  serverName: 'api-server-1',
});
```

#### Datadog (APM & Logging)

```typescript
import { DatadogIntegration } from '@portfolio/logger';

const datadogTransport = new DatadogIntegration({
  apiKey: 'your-datadog-api-key',
  site: 'datadoghq.com', // or 'datadoghq.eu'
  service: 'your-service-name',
  version: '1.0.0',
  hostname: 'your-hostname',
});
```

#### New Relic (APM)

```typescript
import { NewRelicIntegration } from '@portfolio/logger';

const newrelicTransport = new NewRelicIntegration({
  licenseKey: 'your-newrelic-license-key',
  applicationName: 'your-app-name',
  euEndpoint: false, // Set to true for EU data centers
});
```

#### LogRocket (Session Replay)

```typescript
import { LogRocketIntegration } from '@portfolio/logger';

const logrocketTransport = new LogRocketIntegration({
  apiToken: 'your-logrocket-token',
  appId: 'your-app-id',
  includeSessionUrl: true,
  sessionProperties: {
    plan: 'premium',
    userId: '123',
  },
});
```

### Cloud Provider Integrations

#### AWS CloudWatch

```typescript
import { CloudWatchIntegration } from '@portfolio/logger';

const cloudwatchTransport = new CloudWatchIntegration({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  region: 'us-east-1',
  logGroupName: '/aws/lambda/your-function',
  logStreamName: 'your-stream-name',
});
```

#### Google Cloud Logging

```typescript
import { GoogleCloudIntegration } from '@portfolio/logger';

const gcpTransport = new GoogleCloudIntegration({
  projectId: 'your-gcp-project-id',
  keyFile: JSON.stringify(serviceAccountKey), // Service account JSON
  logName: 'your-log-name',
  resourceType: 'gce_instance',
  resourceLabels: {
    instance_id: 'your-instance-id',
    zone: 'us-central1-a',
  },
});
```

#### Azure Monitor

```typescript
import { AzureMonitorIntegration } from '@portfolio/logger';

const azureTransport = new AzureMonitorIntegration({
  instrumentationKey: 'your-instrumentation-key',
  applicationName: 'your-app-name',
  cloudRoleName: 'your-service-name',
  cloudRoleInstance: 'your-instance-name',
});
```

### Platform Integrations

#### Elasticsearch

```typescript
import { ElasticsearchIntegration } from '@portfolio/logger';

const elasticTransport = new ElasticsearchIntegration({
  host: 'https://your-elasticsearch-host:9200',
  index: 'application-logs',
  username: 'your-username',
  password: 'your-password',
  // Or use API key authentication
  apiKey: 'your-api-key',
});
```

#### Splunk

```typescript
import { SplunkIntegration } from '@portfolio/logger';

const splunkTransport = new SplunkIntegration({
  token: 'your-hec-token',
  host: 'your-splunk-host',
  port: 8088,
  ssl: true,
  sourcetype: 'your-app',
  source: 'application-logs',
  index: 'main',
});
```

#### Papertrail

```typescript
import { PapertrailIntegration } from '@portfolio/logger';

const papertrailTransport = new PapertrailIntegration({
  host: 'logs.papertrailapp.com',
  port: 12345, // Your Papertrail port
  program: 'your-app-name',
  hostname: 'your-hostname',
});
```

## Configuration Options

### Common Configuration

All integrations support these common configuration options:

```typescript
interface IntegrationConfig {
  // Integration name (auto-generated if not provided)
  name?: string;
  
  // API key or token
  apiKey?: string;
  
  // Custom endpoint URL
  endpoint?: string;
  
  // Environment (development, production, etc.)
  environment?: string;
  
  // Additional tags to include with all logs
  tags?: Record<string, string>;
  
  // Enable/disable the integration
  enabled?: boolean;
  
  // Batch configuration for performance
  batch?: {
    size: number;        // Number of logs to batch (default: 10)
    flushInterval: number; // Interval in ms to flush (default: 5000)
  };
  
  // Retry configuration for failed requests
  retry?: {
    attempts: number;    // Number of retry attempts (default: 3)
    delay: number;       // Delay between retries in ms (default: 1000)
  };
  
  // Enable debug mode
  debug?: boolean;
}
```

## Multiple Integrations

You can use multiple integrations simultaneously:

```typescript
import { createLogger, integrations, transports, LogLevel } from '@portfolio/logger';

const logger = createLogger({
  level: LogLevel.INFO,
  transports: [
    // Local development - use console transport
    transports.console,
    
    // Error tracking
    integrations.sentry({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    }),
    
    // APM and metrics
    integrations.datadog({
      apiKey: process.env.DATADOG_API_KEY,
      service: 'my-api',
      environment: process.env.NODE_ENV,
    }),
    
    // Long-term storage and search
    integrations.elasticsearch({
      host: process.env.ELASTICSEARCH_URL,
      index: `logs-${process.env.NODE_ENV}`,
      apiKey: process.env.ELASTICSEARCH_API_KEY,
    }),
  ],
});

// Use with context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456',
  component: 'auth-service',
});

requestLogger.info('User login attempt', { email: 'user@example.com' });
requestLogger.error('Login failed', new Error('Invalid credentials'));
```

## Error Handling

Integrations include built-in error handling and retry logic:

```typescript
const resilientLogger = createLogger({
  transports: [
    integrations.datadog({
      apiKey: 'your-key',
      retry: {
        attempts: 5,
        delay: 2000,
      },
      batch: {
        size: 50,
        flushInterval: 10000,
      },
      debug: true, // Enable debug logging for troubleshooting
    }),
  ],
});
```

## Environment-Specific Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  transports: [
    // Always include console in development
    ...(isDevelopment ? [transports.console] : []),
    
    // Only use external services in production
    ...(isProduction ? [
      integrations.sentry({ dsn: process.env.SENTRY_DSN }),
      integrations.datadog({ apiKey: process.env.DATADOG_API_KEY }),
    ] : []),
  ],
});
```

## Performance Considerations

### Batching

Most integrations support batching to improve performance:

```typescript
const highVolumeLogger = createLogger({
  transports: [
    integrations.elasticsearch({
      host: 'your-elasticsearch-host',
      batch: {
        size: 100,        // Batch up to 100 logs
        flushInterval: 5000, // Flush every 5 seconds
      },
    }),
  ],
});
```

### Selective Logging

Use log levels on the main logger to control what gets sent to all services:

```typescript
// Create separate loggers for different purposes
const errorLogger = createLogger({
  level: LogLevel.ERROR, // Only ERROR level logs
  transports: [
    integrations.sentry({ dsn: 'your-dsn' }),
  ],
});

const debugLogger = createLogger({
  level: LogLevel.DEBUG, // All log levels
  transports: [
    transports.console,
    integrations.elasticsearch({ host: 'your-host' }),
  ],
});

// Use appropriate logger based on severity
try {
  await riskyOperation();
} catch (error) {
  errorLogger.error('Critical failure', error); // Goes to Sentry
  debugLogger.debug('Debug info', { context }); // Goes to Elasticsearch
}
```

## Best Practices

1. **Use Environment Variables**: Store API keys and configuration in environment variables
2. **Enable Batching**: For high-volume applications, enable batching to reduce API calls
3. **Configure Retries**: Set appropriate retry policies for network resilience
4. **Use Log Levels**: Control verbosity and costs by filtering log levels per integration
5. **Add Context**: Use child loggers with context for better debugging
6. **Monitor Integration Health**: Enable debug mode to monitor integration performance
7. **Graceful Degradation**: Logger continues working even if integrations fail

## Troubleshooting

### Enable Debug Mode

```typescript
const debugLogger = createLogger({
  transports: [
    integrations.sentry({
      dsn: 'your-dsn',
      debug: true, // This will log integration errors to console
    }),
  ],
});
```

### Check Integration Status

```typescript
const sentryTransport = integrations.sentry({ dsn: 'your-dsn' });

if (sentryTransport.isReady()) {
  console.log('Sentry integration is ready');
} else {
  console.log('Sentry integration is not configured properly');
}
```

### Monitor Integration Health

```typescript
// Create logger with debug mode enabled for all integrations
const monitoredLogger = createLogger({
  transports: [
    integrations.datadog({
      apiKey: 'your-key',
      debug: true, // Logs integration status and errors
    }),
    integrations.sentry({
      dsn: 'your-dsn',
      debug: true, // Logs integration status and errors
    }),
  ],
});

// Integration errors will be logged to console when debug: true
```

## Contributing

To add a new integration:

1. Extend the `BaseIntegration` class
2. Implement the required `send()` method
3. Add transformation logic in `transform()`
4. Export from `integrations/index.ts`
5. Add documentation and examples

See existing integrations for reference implementation patterns.
