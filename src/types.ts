/**
 * Universal logger types with comprehensive logging features
 * Supports structured logging, multiple transports, and enterprise features
 * @author: @portfolio
 * @since: 2025-06-28
 */

/** Log levels with numeric hierarchy */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  HTTP = 4,
  VERBOSE = 5,
  DEBUG = 6,
  SILLY = 7,
}

/** String representations of log levels */
export type LogLevelString = keyof typeof LogLevel;

/** Environment types */
export type Environment = "development" | "production" | "test" | "staging";

/** Log context for correlation and tracing */
export interface LogContext {
  /** Unique request/operation ID */
  requestId?: string;
  /** User identifier */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Component/module name */
  component?: string;
  /** Operation/method name */
  operation?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Performance timing data */
  timing?: {
    startTime?: number;
    duration?: number;
    memory?: NodeJS.MemoryUsage;
  };
}

/** Structured log entry */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Primary message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Log context */
  context?: LogContext;
  /** Error object if applicable */
  error?: Error;
  /** Additional data */
  data?: Record<string, unknown>;
  /** Log entry ID */
  id?: string;
  /** Environment */
  environment?: Environment;
  /** Source information */
  source?: {
    file?: string;
    function?: string;
    line?: number;
    column?: number;
  };
}

/** Transport interface for log output */
export interface Transport {
  /** Transport name */
  name: string;
  /** Write log entry */
  write(entry: LogEntry): Promise<void>;
  /** Cleanup resources */
  close?(): Promise<void>;
  /** Check if transport is ready */
  isReady?(): boolean;
  /** Handle transport errors */
  onError?(error: Error): void;
}

/** Formatter interface for log formatting */
export interface Formatter {
  /** Format a log entry */
  format(entry: LogEntry): string;
}

/** Logger configuration */
export interface LoggerConfig {
  /** Minimum log level */
  level: LogLevel;
  /** Environment */
  environment: Environment;
  /** Transports to use */
  transports: Transport[];
  /** Default formatter */
  formatter?: Formatter;
  /** Enable/disable logging */
  enabled: boolean;
  /** Default context */
  defaultContext?: Partial<LogContext>;
  /** Performance monitoring */
  performance: {
    enabled: boolean;
    sampleRate: number;
  };
  /** Rate limiting */
  rateLimit?: {
    max: number;
    windowMs: number;
  };
  /** Batch settings */
  batch?: {
    enabled: boolean;
    size: number;
    flushInterval: number;
  };
  /** Error handling */
  errorHandling: {
    handleExceptions: boolean;
    handleRejections: boolean;
    exitOnError: boolean;
  };
}

/** Logger instance interface */
export interface ILogger {
  /** Set log level */
  setLevel(level: LogLevel | LogLevelString): void;
  /** Add transport */
  addTransport(transport: Transport): void;
  /** Remove transport */
  removeTransport(name: string): void;
  /** Add context */
  setContext(context: Partial<LogContext>): ILogger;
  /** Create child logger with context */
  child(context: Partial<LogContext>): ILogger;

  /** Log methods */
  error(message: string, data?: unknown, context?: Partial<LogContext>): void;
  warn(message: string, data?: unknown, context?: Partial<LogContext>): void;
  info(message: string, data?: unknown, context?: Partial<LogContext>): void;
  http(message: string, data?: unknown, context?: Partial<LogContext>): void;
  verbose(message: string, data?: unknown, context?: Partial<LogContext>): void;
  debug(message: string, data?: unknown, context?: Partial<LogContext>): void;
  silly(message: string, data?: unknown, context?: Partial<LogContext>): void;

  /** Generic log method */
  log(
    level: LogLevel | LogLevelString,
    message: string,
    data?: unknown,
    context?: Partial<LogContext>
  ): void;

  /** Performance monitoring */
  time(label: string): void;
  timeEnd(label: string): void;

  /** Metrics */
  counter(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;

  /** Lifecycle */
  flush(): Promise<void>;
  close(): Promise<void>;
}

/** Plugin interface */
export interface LoggerPlugin {
  /** Plugin name */
  name: string;
  /** Initialize plugin */
  init?(config: LoggerConfig): void;
  /** Process log entry before transports */
  beforeTransport?(entry: LogEntry): LogEntry | null;
  /** Process log entry after transports */
  afterTransport?(entry: LogEntry): void;
  /** Cleanup plugin */
  destroy?(): void;
}

/** Utility types */
export type LogMethod = (
  message: string,
  data?: unknown,
  context?: Partial<LogContext>
) => void;
export type TimerMap = Map<
  string,
  { startTime: number; startMemory: NodeJS.MemoryUsage }
>;
export type MetricType = "counter" | "gauge" | "histogram";

/** Metric entry */
export interface MetricEntry {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

/** Performance entry */
export interface PerformanceEntry {
  label: string;
  duration: number;
  memoryDelta: Partial<NodeJS.MemoryUsage>;
  timestamp: Date;
}
