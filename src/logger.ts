/**
 * Universal logger core implementation
 * Comprehensive, robust, scalable, and flexible logging system
 */

import { formatters } from "./formatters.js";
import { transports } from "./transports.js";
import {
  type ILogger,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
  type LoggerPlugin,
  type LogLevel,
  LogLevel as LogLevelEnum,
  type LogLevelString,
  type MetricEntry,
  type MetricType,
  type TimerMap,
  type Transport,
} from "./types";
import {
  detectEnvironment,
  generateId,
  getMemoryUsage,
  getStackTrace,
  mergeContexts,
  parseLogLevel,
  RateLimiter,
  sanitizeData,
  shouldLog,
} from "./utils.js";

/** Default logger configuration */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevelEnum.INFO,
  environment: detectEnvironment(),
  transports: [transports.console],
  formatter: formatters.console,
  enabled: true,
  performance: {
    enabled: true,
    sampleRate: 1.0,
  },
  errorHandling: {
    handleExceptions: true,
    handleRejections: true,
    exitOnError: false,
  },
};

/**
 * Universal Logger Class
 * @implements ILogger
 */
export class Logger implements ILogger {
  private config: LoggerConfig;
  private context: LogContext;
  private plugins: LoggerPlugin[] = [];
  private timers: TimerMap = new Map();
  private metrics: MetricEntry[] = [];
  private rateLimiter?: RateLimiter;
  private isDestroyed = false;

  constructor(
    config: Partial<LoggerConfig> = {},
    context: Partial<LogContext> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = { ...context };

    // Setup rate limiting if configured
    if (this.config.rateLimit) {
      this.rateLimiter = new RateLimiter(
        this.config.rateLimit.max,
        this.config.rateLimit.windowMs
      );
    }

    // Setup error handling
    this.setupErrorHandling();

    // Initialize plugins
    this.plugins.forEach((plugin) => plugin.init?.(this.config));
  }

  /** Set log level */
  setLevel(level: LogLevel | LogLevelString): void {
    this.config.level = parseLogLevel(level);
  }

  /** Add transport */
  addTransport(transport: Transport): void {
    if (!this.config.transports.includes(transport)) {
      this.config.transports.push(transport);
    }
  }

  /** Remove transport */
  removeTransport(name: string): void {
    this.config.transports = this.config.transports.filter(
      (t) => t.name !== name
    );
  }

  /** Add plugin */
  addPlugin(plugin: LoggerPlugin): void {
    this.plugins.push(plugin);
    plugin.init?.(this.config);
  }

  /** Remove plugin */
  removePlugin(name: string): void {
    const plugin = this.plugins.find((p) => p.name === name);
    if (plugin) {
      plugin.destroy?.();
      this.plugins = this.plugins.filter((p) => p.name !== name);
    }
  }

  /** Set context */
  setContext(context: Partial<LogContext>): ILogger {
    this.context = mergeContexts(this.context, context);
    return this;
  }

  /** Create child logger with additional context */
  child(context: Partial<LogContext>): ILogger {
    const childContext = mergeContexts(this.context, context);
    return new Logger(this.config, childContext);
  }

  /** Log methods */
  error(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.ERROR, message, data, context);
  }

  warn(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.WARN, message, data, context);
  }

  info(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.INFO, message, data, context);
  }

  http(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.HTTP, message, data, context);
  }

  verbose(
    message: string,
    data?: unknown,
    context?: Partial<LogContext>
  ): void {
    this.log(LogLevelEnum.VERBOSE, message, data, context);
  }

  debug(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.DEBUG, message, data, context);
  }

  silly(message: string, data?: unknown, context?: Partial<LogContext>): void {
    this.log(LogLevelEnum.SILLY, message, data, context);
  }

  /** Generic log method */
  log(
    level: LogLevel | LogLevelString,
    message: string,
    data?: unknown,
    context?: Partial<LogContext>
  ): void {
    if (this.isDestroyed || !this.config.enabled) return;

    const logLevel = parseLogLevel(level);

    // Check if we should log this level
    if (!shouldLog(this.config.level, logLevel)) return;

    // Check rate limiting
    if (this.rateLimiter && !this.rateLimiter.isAllowed()) return;

    try {
      // Create log entry
      const entry = this.createLogEntry(logLevel, message, data, context);

      // Process through plugins
      let processedEntry: LogEntry | null = entry;
      for (const plugin of this.plugins) {
        processedEntry =
          plugin.beforeTransport?.(processedEntry) ?? processedEntry;
        if (!processedEntry) return; // Plugin filtered out the entry
      }

      // Write to transports
      this.writeToTransports(processedEntry).catch((error) => {
        this.handleInternalError(error, "writing to transports");
      });

      // Post-process through plugins
      for (const plugin of this.plugins) {
        plugin.afterTransport?.(processedEntry);
      }
    } catch (error) {
      this.handleInternalError(error, "logging");
    }
  }

  /** Performance monitoring */
  time(label: string): void {
    const startTime = performance.now();
    const startMemory = getMemoryUsage();

    this.timers.set(label, {
      startTime,
      startMemory: startMemory || ({} as NodeJS.MemoryUsage),
    });
  }

  timeEnd(label: string): void {
    const timer = this.timers.get(label);
    if (!timer) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }

    const duration = performance.now() - timer.startTime;
    const endMemory = getMemoryUsage();

    let memoryDelta: Partial<NodeJS.MemoryUsage> | undefined;
    if (timer.startMemory && endMemory) {
      memoryDelta = {
        rss: endMemory.rss - timer.startMemory.rss,
        heapTotal: endMemory.heapTotal - timer.startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
        external: endMemory.external - timer.startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - timer.startMemory.arrayBuffers,
      };
    }

    this.info(
      `Timer '${label}' completed`,
      { duration, memoryDelta },
      {
        timing: { duration, memory: endMemory },
      }
    );

    this.timers.delete(label);
  }

  /** Metrics */
  counter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    this.recordMetric("counter", name, value, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric("gauge", name, value, tags);
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric("histogram", name, value, tags);
  }

  /** Lifecycle */
  async flush(): Promise<void> {
    const promises = this.config.transports.map(async (transport) => {
      try {
        // If transport has a flush method, call it
        if ("flush" in transport && typeof transport.flush === "function") {
          await transport.flush();
        }
      } catch (error) {
        this.handleInternalError(error, `flushing transport ${transport.name}`);
      }
    });

    await Promise.allSettled(promises);
  }

  async close(): Promise<void> {
    this.isDestroyed = true;

    // Flush all transports
    await this.flush();

    // Close all transports
    const promises = this.config.transports.map(async (transport) => {
      try {
        await transport.close?.();
      } catch (error) {
        this.handleInternalError(error, `closing transport ${transport.name}`);
      }
    });

    await Promise.allSettled(promises);

    // Destroy plugins
    this.plugins.forEach((plugin) => {
      try {
        plugin.destroy?.();
      } catch (error) {
        this.handleInternalError(error, `destroying plugin ${plugin.name}`);
      }
    });

    // Clear state
    this.timers.clear();
    this.metrics.length = 0;
  }

  /** Private methods */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: Partial<LogContext>
  ): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      level,
      message,
      timestamp: new Date(),
      environment: this.config.environment,
      context: mergeContexts(this.config.defaultContext, this.context, context),
      data: data ? (sanitizeData(data) as Record<string, unknown>) : undefined,
      source: getStackTrace(2), // Skip logger internal calls
    };

    // Handle error objects
    if (data instanceof Error) {
      entry.error = data;
      entry.data = undefined; // Don't duplicate error in data
    }

    return entry;
  }

  private async writeToTransports(entry: LogEntry): Promise<void> {
    if (this.config.transports.length === 0) return;

    const promises = this.config.transports.map(async (transport) => {
      try {
        if (transport.isReady?.() !== false) {
          await transport.write(entry);
        }
      } catch (error) {
        this.handleInternalError(error, `transport ${transport.name}`);
      }
    });

    await Promise.allSettled(promises);
  }

  private recordMetric(
    type: MetricType,
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    if (!this.config.performance.enabled) return;

    // Sample metrics based on sample rate
    if (Math.random() > this.config.performance.sampleRate) return;

    const metric: MetricEntry = {
      name,
      type,
      value,
      tags,
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Log metric if debugging
    if (shouldLog(this.config.level, LogLevelEnum.DEBUG)) {
      this.debug(`Metric recorded: ${type} ${name}=${value}`, { metric });
    }

    // Keep metrics array bounded
    if (this.metrics.length > 1000) {
      this.metrics.splice(0, 500); // Remove first half
    }
  }

  private setupErrorHandling(): void {
    if (
      !this.config.errorHandling.handleExceptions &&
      !this.config.errorHandling.handleRejections
    ) {
      return;
    }

    // Handle uncaught exceptions (Node.js)
    if (
      this.config.errorHandling.handleExceptions &&
      typeof process !== "undefined"
    ) {
      const handleException = (error: Error) => {
        this.error("Uncaught Exception", error, { component: "error-handler" });
        if (this.config.errorHandling.exitOnError) {
          process.exit(1);
        }
      };

      process.on("uncaughtException", handleException);
    }

    // Handle unhandled promise rejections
    if (
      this.config.errorHandling.handleRejections &&
      typeof process !== "undefined"
    ) {
      const handleRejection = (reason: unknown, promise: Promise<unknown>) => {
        this.error("Unhandled Promise Rejection", reason, {
          component: "error-handler",
          metadata: { promise: promise.toString() },
        });
        if (this.config.errorHandling.exitOnError) {
          process.exit(1);
        }
      };

      process.on("unhandledRejection", handleRejection);
    }
  }

  private handleInternalError(error: unknown, context: string): void {
    try {
      // Avoid infinite recursion by using console directly
      console.error(`[Logger Internal Error] ${context}:`, error);
    } catch {
      // If even console.error fails, there's nothing we can do
    }
  }
}

/** Factory function to create loggers */
export const createLogger = (
  config?: Partial<LoggerConfig>,
  context?: Partial<LogContext>
): ILogger => new Logger(config, context);

/** Default logger instance */
export const logger = createLogger();
