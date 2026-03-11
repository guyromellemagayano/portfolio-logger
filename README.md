<!-- markdownlint-disable no-emphasis-as-heading line-length -->

# `@portfolio/logger`

Shared logging toolkit for the portfolio workspace with structured logs, transport adapters, formatter pipelines, and integration helpers for Node.js and browser runtimes.

## Features

- 🚀 **Structured Logging Core**: Logger instance, factory API, context propagation, and child loggers
- 🎛️ **Multi-Level Logging**: `SILENT`, `ERROR`, `WARN`, `INFO`, `HTTP`, `VERBOSE`, `DEBUG`, `SILLY`
- 🚚 **Transport System**: Console, file, HTTP, memory, stream, null, and multi-transport orchestration
- 🎨 **Formatter Pipeline**: JSON, console, development, production, and simple formatter support
- 🔌 **Integration Suite**: Exported integrations for Sentry, Datadog, New Relic, LogRocket, Splunk, and cloud providers
- 📊 **Runtime Utilities**: Metrics, timers, ID generation, rate-limiting helpers, and data sanitization utilities
- 🔁 **Dual-Module Output**: ESM + CommonJS exports with typed subpath entrypoints

## Installation

Install in a workspace consumer:

```bash
pnpm add @portfolio/logger
```

Typical workspace dependency declaration:

```json
{
  "dependencies": {
    "@portfolio/logger": "workspace:*"
  }
}
```

## Export Overview

Primary package entrypoint:

```typescript
import {
  createLogger,
  integrations,
  logger,
  LogLevel,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "@portfolio/logger";
```

Subpath entrypoints:

```typescript
import { formatters } from "@portfolio/logger/formatters";
import { transports } from "@portfolio/logger/transports";
import { utils } from "@portfolio/logger/utils";
```

### Export Groups

- `Core`: `logger`, `createLogger`, `Logger`, `LogLevel`
- `Transports`: `ConsoleTransport`, `FileTransport`, `HttpTransport`, `MemoryTransport`, `MultiTransport`, `StreamTransport`, `NullTransport`
- `Formatters`: `JsonFormatter`, `ConsoleFormatter`, `DevFormatter`, `ProductionFormatter`, `SimpleFormatter`
- `Integrations`: `integrations` export group (`sentry`, `datadog`, `newrelic`, `logrocket`, cloud/platform integrations)
- `Utilities`: `utils` bundle + named runtime helpers (`sanitizeData`, `shouldLog`, `RateLimiter`, etc.)
- `Legacy Helpers`: `log`, `logInfo`, `logWarn`, `logError`, `logDebug`, `logTrace`

## Setup

### 1. Use the Default Logger

```typescript
import { logger } from "@portfolio/logger";

logger.info("Application started");
logger.error("Failed to load profile", new Error("Profile missing"));
```

### 2. Create a Configured Logger

```typescript
import {
  createLogger,
  formatters,
  LogLevel,
  transports,
} from "@portfolio/logger";

const appLogger = createLogger({
  level: LogLevel.INFO,
  transports: [transports.console],
  formatter: formatters.json,
});
```

### 3. Use Child Context for Requests

```typescript
const requestLogger = appLogger.child({
  requestId: "req-123",
  component: "api-gateway",
});

requestLogger.info("Request received");
```

## Integration Examples

### Sentry + Datadog Composition

```typescript
import { createLogger, integrations } from "@portfolio/logger";

const logger = createLogger({
  transports: [
    integrations.sentry({ dsn: process.env.SENTRY_DSN }),
    integrations.datadog({ apiKey: process.env.DATADOG_API_KEY }),
  ],
});
```

### Provider-Specific Setup Reference

Use `INTEGRATIONS.md` for full provider configuration examples and option details.

## Development

Run from `packages/logger`:

```bash
pnpm build
pnpm check-types
pnpm check-types:scripts
pnpm lint
pnpm test
pnpm test:run
pnpm test:coverage
pnpm test:build
pnpm format:check
```

## Testing

This package includes Vitest suites for logger behavior and log utility contracts:

- `src/__tests__/logger.test.ts`
- `src/__tests__/log.test.ts`

Validation coverage includes:

- Logger level behavior and transport routing
- Formatter output paths and log payload shaping
- Compatibility helper behavior (`logInfo`, `logError`, etc.)
- Build-validation script checks via `test:build`

## Best Practices

### 1. **Centralize Logger Construction**

- Create one app-level logger instance and inject child contexts where needed.
- Keep transport wiring at service boundaries.

### 2. **Use Context-Rich Events**

- Attach `requestId`, `component`, and operation metadata in child logger contexts.
- Keep error payloads structured instead of string-concatenated.

### 3. **Prefer Subpath Imports for Advanced APIs**

- Import from `@portfolio/logger/formatters`, `@portfolio/logger/transports`, and `@portfolio/logger/utils` when using specialized modules.
- Keep root imports focused on core logger usage.

### 4. **Sanitize Sensitive Fields**

- Use built-in sanitization helpers for logs containing auth or identity fields.
- Avoid passing raw secrets or tokens to transport payloads.

## Troubleshooting

### Common Issues

**Subpath import cannot be resolved**

Ensure consumer tooling reads package `exports` maps and install dependencies from workspace root:

```bash
pnpm install
```

**Logs are not emitted at runtime**

Verify logger level, configured transport list, and environment-specific filtering.

**Integration transport does not receive events**

Confirm required provider keys/options are present and validate transport-specific endpoint configuration in `INTEGRATIONS.md`.

## Dependencies

- Runtime dependencies: none
- Dev dependencies: shared workspace tooling (`@portfolio/config-eslint`, `@portfolio/config-typescript`, `vitest`, `typescript`, `bunchee`, and related lint/test tooling)
- Package publish target: GitHub Packages (`"publishConfig.registry": "https://npm.pkg.github.com/"`)
