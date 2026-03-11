/**
 * Universal logger formatters with multiple output formats
 * Supports JSON, text, colored console, and custom formatting
 */

import { type Formatter, type LogEntry, LogLevel } from "./types";

/** ANSI color codes for console output */
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

/** Log level colors mapping */
const LEVEL_COLORS = {
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.HTTP]: COLORS.magenta,
  [LogLevel.VERBOSE]: COLORS.cyan,
  [LogLevel.DEBUG]: COLORS.blue,
  [LogLevel.SILLY]: COLORS.gray,
  [LogLevel.SILENT]: COLORS.gray,
} as const;

/** Log level names mapping */
const LEVEL_NAMES = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.HTTP]: "HTTP",
  [LogLevel.VERBOSE]: "VERBOSE",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.SILLY]: "SILLY",
  [LogLevel.SILENT]: "SILENT",
} as const;

/** Utility functions */
const utils = {
  /** Safely stringify any value */
  stringify(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (value instanceof Error) {
      return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  },

  /** Truncate string to max length */
  truncate(str: string, maxLength: number): string {
    return str.length > maxLength ? `${str.slice(0, maxLength - 3)}...` : str;
  },

  /** Format timestamp */
  formatTimestamp(date: Date): string {
    return date.toISOString();
  },

  /** Format duration in human readable format */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
  },

  /** Format memory usage */
  formatMemory(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)}${units[unitIndex]}`;
  },
};

/** JSON formatter for structured logging */
export class JsonFormatter implements Formatter {
  private readonly pretty: boolean;
  private readonly includeStack: boolean;

  constructor(options: { pretty?: boolean; includeStack?: boolean } = {}) {
    this.pretty = options.pretty ?? false;
    this.includeStack = options.includeStack ?? true;
  }

  format(entry: LogEntry): string {
    const formatted = {
      timestamp: utils.formatTimestamp(entry.timestamp),
      level: LEVEL_NAMES[entry.level],
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.data && { data: entry.data }),
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          ...(this.includeStack &&
            entry.error.stack && { stack: entry.error.stack }),
        },
      }),
      ...(entry.id && { id: entry.id }),
      ...(entry.environment && { environment: entry.environment }),
      ...(entry.source && { source: entry.source }),
    };

    return JSON.stringify(formatted, null, this.pretty ? 2 : undefined);
  }
}

/** Simple text formatter */
export class SimpleFormatter implements Formatter {
  private readonly includeTimestamp: boolean;
  private readonly includeLevel: boolean;
  private readonly maxMessageLength: number;

  constructor(
    options: {
      includeTimestamp?: boolean;
      includeLevel?: boolean;
      maxMessageLength?: number;
    } = {}
  ) {
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.includeLevel = options.includeLevel ?? true;
    this.maxMessageLength = options.maxMessageLength ?? 500;
  }

  format(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.includeTimestamp) {
      parts.push(`[${utils.formatTimestamp(entry.timestamp)}]`);
    }

    if (this.includeLevel) {
      parts.push(`[${LEVEL_NAMES[entry.level]}]`);
    }

    if (entry.context?.component) {
      parts.push(`[${entry.context.component}]`);
    }

    // Include requestId if present
    if (entry.context?.requestId) {
      parts.push(`[${entry.context.requestId}]`);
    }

    // Include other context fields that might be important for tests
    if (entry.context) {
      const contextEntries = Object.entries(entry.context);
      for (const [key, value] of contextEntries) {
        if (
          key !== "component" &&
          key !== "requestId" &&
          key !== "timing" &&
          key !== "metadata"
        ) {
          parts.push(`[${key}:${value}]`);
        }
      }
    }

    parts.push(utils.truncate(entry.message, this.maxMessageLength));

    if (entry.data) {
      parts.push(`Data: ${utils.stringify(entry.data)}`);
    }

    if (entry.error) {
      parts.push(`Error: ${utils.stringify(entry.error)}`);
    }

    if (entry.context?.timing?.duration !== undefined) {
      parts.push(
        `Duration: ${utils.formatDuration(entry.context.timing.duration)}`
      );
    }

    return parts.join(" ");
  }
}

/** Console formatter with colors and enhanced formatting */
export class ConsoleFormatter implements Formatter {
  private readonly colors: boolean;
  private readonly includeContext: boolean;
  private readonly includePerformance: boolean;

  constructor(
    options: {
      colors?: boolean;
      includeContext?: boolean;
      includePerformance?: boolean;
    } = {}
  ) {
    this.colors = options.colors ?? true;
    this.includeContext = options.includeContext ?? true;
    this.includePerformance = options.includePerformance ?? true;
  }

  format(entry: LogEntry): string {
    const { colors } = this;
    const timestamp = utils.formatTimestamp(entry.timestamp);
    const level = LEVEL_NAMES[entry.level];
    const levelColor = LEVEL_COLORS[entry.level];

    const parts: string[] = [];

    // Timestamp
    parts.push(
      colors ? `${COLORS.gray}${timestamp}${COLORS.reset}` : timestamp
    );

    // Level with color
    const levelPart = `[${level.padEnd(7)}]`;
    parts.push(
      colors
        ? `${levelColor}${COLORS.bright}${levelPart}${COLORS.reset}`
        : levelPart
    );

    // Component/context
    if (this.includeContext && entry.context?.component) {
      const component = `[${entry.context.component}]`;
      parts.push(
        colors ? `${COLORS.cyan}${component}${COLORS.reset}` : component
      );
    }

    // Request ID
    if (this.includeContext && entry.context?.requestId) {
      const reqId = `(${entry.context.requestId.slice(-8)})`;
      parts.push(colors ? `${COLORS.yellow}${reqId}${COLORS.reset}` : reqId);
    }

    // Message
    parts.push(
      colors ? `${COLORS.white}${entry.message}${COLORS.reset}` : entry.message
    );

    // Data
    if (entry.data) {
      const dataStr = utils.stringify(entry.data);
      parts.push(colors ? `${COLORS.dim}${dataStr}${COLORS.reset}` : dataStr);
    }

    // Error
    if (entry.error) {
      const errorStr = utils.stringify(entry.error);
      parts.push(colors ? `${COLORS.red}${errorStr}${COLORS.reset}` : errorStr);
    }

    // Performance information
    if (this.includePerformance && entry.context?.timing) {
      const { timing } = entry.context;
      const perfParts: string[] = [];

      if (timing.duration !== undefined) {
        perfParts.push(`${utils.formatDuration(timing.duration)}`);
      }

      if (timing.memory) {
        perfParts.push(`mem: ${utils.formatMemory(timing.memory.heapUsed)}`);
      }

      if (perfParts.length > 0) {
        const perfStr = `(${perfParts.join(", ")})`;
        parts.push(
          colors ? `${COLORS.magenta}${perfStr}${COLORS.reset}` : perfStr
        );
      }
    }

    return parts.join(" ");
  }
}

/** Development formatter with enhanced debugging info */
export class DevFormatter implements Formatter {
  private readonly consoleFormatter: ConsoleFormatter;
  private readonly includeSource: boolean;
  private readonly includeMetadata: boolean;

  constructor(
    options: {
      includeSource?: boolean;
      includeMetadata?: boolean;
    } = {}
  ) {
    this.consoleFormatter = new ConsoleFormatter({
      colors: true,
      includeContext: true,
      includePerformance: true,
    });
    this.includeSource = options.includeSource ?? true;
    this.includeMetadata = options.includeMetadata ?? true;
  }

  format(entry: LogEntry): string {
    let formatted = this.consoleFormatter.format(entry);

    // Add source information
    if (this.includeSource && entry.source) {
      const { file, function: fn, line } = entry.source;
      const sourceInfo = [
        file && `${file}`,
        fn && `${fn}()`,
        line && `L${line}`,
      ]
        .filter(Boolean)
        .join(":");

      if (sourceInfo) {
        formatted += ` ${COLORS.dim}(${sourceInfo})${COLORS.reset}`;
      }
    }

    // Add metadata
    if (this.includeMetadata && entry.context?.metadata) {
      const metaStr = utils.stringify(entry.context.metadata);
      formatted += ` ${COLORS.dim}Meta: ${metaStr}${COLORS.reset}`;
    }

    return formatted;
  }
}

/** Production formatter optimized for log aggregation */
export class ProductionFormatter implements Formatter {
  private readonly jsonFormatter: JsonFormatter;

  constructor() {
    this.jsonFormatter = new JsonFormatter({
      pretty: false,
      includeStack: false,
    });
  }

  format(entry: LogEntry): string {
    // Remove sensitive data in production
    const sanitizedEntry = {
      ...entry,
      context: entry.context
        ? {
            ...entry.context,
            // Remove potentially sensitive metadata
            metadata: undefined,
          }
        : undefined,
    };

    return this.jsonFormatter.format(sanitizedEntry);
  }
}

/** Factory function to create formatters */
export const createFormatter = (
  type: "json" | "simple" | "console" | "dev" | "production",
  options?: Record<string, unknown>
): Formatter => {
  switch (type) {
    case "json":
      return new JsonFormatter(options);
    case "simple":
      return new SimpleFormatter(options);
    case "console":
      return new ConsoleFormatter(options);
    case "dev":
      return new DevFormatter(options);
    case "production":
      return new ProductionFormatter();
    default:
      throw new Error(`Unknown formatter type: ${type}`);
  }
};

/** Default formatters */
export const formatters = {
  json: new JsonFormatter(),
  simple: new SimpleFormatter(),
  console: new ConsoleFormatter(),
  dev: new DevFormatter(),
  production: new ProductionFormatter(),
} as const;
