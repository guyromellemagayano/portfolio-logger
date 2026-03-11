<!-- markdownlint-disable MD024 -->

# @portfolio/logger

A comprehensive, robust, scalable, and flexible logging system for Node.js
and browser environments with structured logging, multiple transports,
formatters, performance monitoring, and enterprise features.

## ✨ Features

### 🎯 **Comprehensive Logging**

- Multiple log levels (SILENT, ERROR, WARN, INFO, HTTP, VERBOSE, DEBUG, SILLY)
- Structured logging with JSON support
- Context and correlation ID tracking
- Error object handling with stack traces
- Data sanitization and security

### 🚚 **Multiple Transports**

- Console transport with colored output
- File transport with rotation
- HTTP transport for remote logging
- Stream transport for custom destinations
- Memory transport for testing
- Multi-transport support

### 🎨 **Flexible Formatters**

- JSON formatter for structured data
- Console formatter with colors and context
- Simple text formatter
- Development formatter with debugging info
- Production formatter with data sanitization
- Custom formatters support

### ⚡ **Performance & Monitoring**

- Built-in performance timing
- Memory usage monitoring
- Metrics collection (counters, gauges, histograms)
- Rate limiting and batching
- Async logging with queuing

### 🏢 **Enterprise Features**

- Plugin architecture for extensibility
- Child loggers with inherited context
- Error handling and recovery
- Graceful shutdown and cleanup
- Environment detection
- Browser and Node.js compatibility

## 📦 Installation

Install the logger package using your preferred package manager:

```bash
# Using npm
npm install @portfolio/logger

# Using yarn
yarn add @portfolio/logger

# Using pnpm
pnpm add @portfolio/logger

# Using bun
bun add @portfolio/logger
```

## 🚀 Module Support

This package ships **dual-module builds** (ESM + CommonJS).

### ESM Import

```typescript
import { createLogger, logger, LogLevel } from "@portfolio/logger";
import { formatters } from "@portfolio/logger/formatters";
import { transports } from "@portfolio/logger/transports";
import { utils } from "@portfolio/logger/utils";
```

### CommonJS Require

```javascript
const { logger, createLogger, LogLevel } = require("@portfolio/logger");
const { formatters } = require("@portfolio/logger/formatters");
```

### Build Output Structure

`bunchee` generates module-specific outputs:

```text
dist/
├── es/
│   ├── index.mjs
│   ├── index.d.mts
│   ├── formatters.mjs
│   ├── transports.mjs
│   └── utils.mjs
└── cjs/
    ├── index.cjs
    ├── index.d.cts
    ├── formatters.cjs
    ├── transports.cjs
    └── utils.cjs
```

### Build Configuration

Module resolution is configured in `package.json` via conditional exports:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/es/index.d.mts",
        "default": "./dist/es/index.mjs"
      },
      "require": {
        "types": "./dist/cjs/index.d.cts",
        "default": "./dist/cjs/index.cjs"
      }
    }
  }
}
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { logger } from "@portfolio/logger";

// Simple logging
logger.info("Application started");
logger.error("Something went wrong", new Error("Details"));

// With additional data
logger.info("User logged in", { userId: 123, method: "oauth" });

// With context
logger.info(
  "Processing request",
  { orderId: 456 },
  {
    requestId: "req-789",
    component: "order-service",
  }
);
```

### Advanced Configuration

```typescript
import {
  ConsoleTransport,
  createLogger,
  formatters,
  HttpTransport,
  LogLevel,
} from "@portfolio/logger";

const appLogger = createLogger({
  level: LogLevel.DEBUG,
  environment: "production",
  transports: [
    new ConsoleTransport({
      formatter: formatters.console,
      useColors: true,
    }),
    new HttpTransport({
      url: "https://logs.example.com/api/logs",
      batchSize: 50,
      flushInterval: 5000,
    }),
  ],
  performance: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
  },
  rateLimit: {
    max: 1000,
    windowMs: 60000, // 1000 logs per minute
  },
  errorHandling: {
    handleExceptions: true,
    handleRejections: true,
    exitOnError: false,
  },
});
```

## 📊 Performance Monitoring

### Timing Operations

```typescript
import { logger } from "@portfolio/logger";

// Measure execution time
logger.time("database-query");
await performDatabaseQuery();
logger.timeEnd("database-query");
// Logs: Timer 'database-query' completed (150.25ms, mem: +2.1MB)
```

### Metrics Collection

```typescript
// Counter - count occurrences
logger.counter("user.login", 1, { method: "oauth", region: "us-east" });

// Gauge - current value
logger.gauge("memory.usage", 85.5, { service: "api" });

// Histogram - value distribution
logger.histogram("response.time", 150, { endpoint: "/api/users" });
```

## 🏗️ Structured Logging

### Context Management

```typescript
// Set global context
logger.setContext({
  service: "user-api",
  version: "1.2.3",
  environment: "production",
});

// Create child logger with additional context
const requestLogger = logger.child({
  requestId: "req-123",
  userId: 456,
});

requestLogger.info("Processing user request");
// Includes both global and request-specific context
```

### Data Sanitization

```typescript
// Automatically redacts sensitive data
logger.info("User authentication", {
  username: "john.doe",
  password: "secret123", // → [REDACTED]
  apiKey: "key_abc123", // → [REDACTED]
  token: "bearer_xyz789", // → [REDACTED]
  email: "john@example.com", // → preserved
});
```

## 🎨 Formatters

### JSON Formatter

```typescript
import { JsonFormatter } from "@portfolio/logger";

const jsonFormatter = new JsonFormatter({
  pretty: true,
  includeStack: true,
});

// Output: Structured JSON with full context
```

### Console Formatter

```typescript
import { ConsoleFormatter } from "@portfolio/logger";

const consoleFormatter = new ConsoleFormatter({
  colors: true,
  includeContext: true,
  includePerformance: true,
});

// Output: [2024-01-01T00:00:00.000Z] [INFO   ] [user-service] (req-abc123)
// User logged in {"userId":123} (15.2ms, mem: 45.2MB)
```

### Development Formatter

```typescript
import { DevFormatter } from "@portfolio/logger";

const devFormatter = new DevFormatter({
  includeSource: true,
  includeMetadata: true,
});

// Output: Enhanced console output with source location and metadata
```

## 🚚 Transports

### Console Transport

```typescript
import { ConsoleTransport } from "@portfolio/logger";

const consoleTransport = new ConsoleTransport({
  formatter: formatters.console,
  useColors: true,
});
```

### File Transport

```typescript
import { FileTransport } from "@portfolio/logger";

const fileTransport = new FileTransport({
  filename: "./logs/app.log",
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  formatter: formatters.json,
});
```

### HTTP Transport

```typescript
import { HttpTransport } from "@portfolio/logger";

const httpTransport = new HttpTransport({
  url: "https://logs.example.com/api/logs",
  headers: {
    Authorization: "Bearer token123",
    "X-API-Key": "key456",
  },
  batchSize: 25,
  flushInterval: 5000,
  formatter: formatters.json,
});
```

### Memory Transport (Testing)

```typescript
import { MemoryTransport } from "@portfolio/logger";

const memoryTransport = new MemoryTransport({
  maxLogs: 1000,
  formatter: formatters.simple,
});

// Access logs for testing
const logs = memoryTransport.getLogs();
memoryTransport.clear();
```

## 🔌 Plugin System

### Creating Custom Plugins

```typescript
import type { LogEntry, LoggerPlugin } from "@portfolio/logger";

class MetricsPlugin implements LoggerPlugin {
  name = "metrics";

  beforeTransport(entry: LogEntry): LogEntry | null {
    // Collect metrics before logging
    this.collectMetrics(entry);
    return entry;
  }

  afterTransport(entry: LogEntry): void {
    // Post-processing after logging
    this.updateCounters(entry);
  }

  private collectMetrics(entry: LogEntry): void {
    // Custom metrics collection logic
  }

  private updateCounters(entry: LogEntry): void {
    // Update counters based on log entry
  }
}

// Add plugin to logger
logger.addPlugin(new MetricsPlugin());
```

## 🌍 Environment Configuration

### Automatic Environment Detection

```typescript
import { detectEnvironment, LogLevel } from "@portfolio/logger";

const env = detectEnvironment(); // 'development' | 'production' | 'test' | 'staging'

const config = {
  level: env === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  transports:
    env === "production" ? [httpTransport, fileTransport] : [consoleTransport],
  formatter: env === "production" ? formatters.production : formatters.dev,
};
```

### Environment-Specific Formatters

```typescript
// Development: Enhanced console output with source info
const devLogger = createLogger({
  formatter: formatters.dev,
  transports: [consoleTransport],
});

// Production: JSON output with sanitized data
const prodLogger = createLogger({
  formatter: formatters.production,
  transports: [httpTransport, fileTransport],
});
```

## 🔒 Security Features

### Data Sanitization

Automatically redacts sensitive fields:

- `password`, `secret`, `token`, `auth`, `key`
- Configurable field patterns
- Deep object traversal
- Circular reference handling

### Rate Limiting

```typescript
const logger = createLogger({
  rateLimit: {
    max: 1000, // Maximum logs
    windowMs: 60000, // Per time window (1 minute)
  },
});
```

## 📈 Browser Support

### Browser-Specific Features

```typescript
// Automatic environment detection
// localStorage integration (optional)
// Performance API usage
// Error boundary integration
```

### Usage in React

```typescript
import { logger } from '@portfolio/logger';

function UserComponent({ userId }: { userId: number }) {
  const componentLogger = logger.child({ component: 'UserComponent', userId });

  useEffect(() => {
    componentLogger.info('Component mounted');
    return () => componentLogger.info('Component unmounted');
  }, []);

  const handleAction = () => {
    componentLogger.time('user-action');
    // Perform action
    componentLogger.timeEnd('user-action');
  };

  return <div>...</div>;
}
```

## 🧪 Testing

### Using Memory Transport

```typescript
import { createLogger, LogLevel, MemoryTransport } from "@portfolio/logger";

describe("Application Logic", () => {
  let logger: Logger;
  let memoryTransport: MemoryTransport;

  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    logger = createLogger({
      level: LogLevel.DEBUG,
      transports: [memoryTransport],
    });
  });

  it("logs user actions", () => {
    logger.info("User action", { action: "click", element: "button" });

    const logs = memoryTransport.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("User action");
  });
});
```

## 💡 Best Practices

### 1. Use Appropriate Log Levels

```typescript
logger.error("Critical system failure", error); // System errors
logger.warn("Deprecated API usage"); // Warnings
logger.info("User logged in", { userId }); // Business events
logger.http("GET /api/users", { responseTime }); // HTTP requests
logger.verbose("Cache hit", { key, ttl }); // Detailed info
logger.debug("Variable state", { variables }); // Debug info
logger.silly("Function entry", { args }); // Trace info

// SILENT level (0) - disables all logging
const silentLogger = createLogger({ level: LogLevel.SILENT });
```

### 2. Use Structured Context

```typescript
// Good: Structured context
const userLogger = logger.child({
  component: "user-service",
  version: "1.0.0",
});

userLogger.info("User action", {
  userId: 123,
  action: "login",
  timestamp: new Date().toISOString(),
});

// Avoid: String concatenation
logger.info(`User 123 performed login at ${new Date()}`);
```

### 3. Performance Monitoring

```typescript
// Measure important operations
logger.time("database-query");
const result = await database.query("SELECT * FROM users");
logger.timeEnd("database-query");

// Track business metrics
logger.counter("user.signup", 1, { source: "web" });
logger.gauge("active.connections", connectionCount);
logger.histogram("request.duration", processingTime);
```

### 4. Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", error, {
    operation: "user-update",
    userId: user.id,
    metadata: { retryCount, lastAttempt },
  });
  throw error; // Re-throw if needed
}
```

## 📚 API Reference

### Core Classes

- **`Logger`** - Main logger class
- **`createLogger(config?, context?)`** - Factory function
- **`logger`** - Default logger instance

### Transports

- **`ConsoleTransport`** - Console output
- **`FileTransport`** - File system logging
- **`HttpTransport`** - Remote HTTP logging
- **`StreamTransport`** - Custom stream output
- **`MemoryTransport`** - In-memory storage
- **`MultiTransport`** - Multiple transport fanout

### Formatters

- **`JsonFormatter`** - JSON structured output
- **`ConsoleFormatter`** - Colored console output
- **`SimpleFormatter`** - Plain text output
- **`DevFormatter`** - Enhanced development output
- **`ProductionFormatter`** - Sanitized production output

### Utilities

- **`parseLogLevel()`** - Parse log level strings
- **`shouldLog()`** - Check if level should log
- **`generateId()`** - Generate unique identifiers
- **`sanitizeData()`** - Sanitize sensitive data
- **`detectEnvironment()`** - Auto-detect environment

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 LICENSE

This project is licensed under the MIT LICENSE - see the [LICENSE](LICENSE)
file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/guyromellemagayano/portal)
- [Issue Tracker](https://github.com/guyromellemagayano/portal/issues)
- [Package Registry](https://npm.pkg.github.com/)
- [Integrations Guide](./INTEGRATIONS.md) - Detailed integration examples
  and configurations
