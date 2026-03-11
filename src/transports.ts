/**
 * Universal logger transports for multiple output destinations
 * Supports console, file, stream, HTTP, and custom transports
 */

import { formatters } from "./formatters.js";
import type { Formatter, LogEntry, Transport } from "./types";

/** Base transport class with common functionality */
abstract class BaseTransport implements Transport {
  public readonly name: string;
  protected formatter: Formatter;
  protected isDestroyed = false;

  constructor(name: string, formatter?: Formatter) {
    this.name = name;
    this.formatter = formatter ?? formatters.simple;
  }

  abstract write(entry: LogEntry): Promise<void>;

  async close(): Promise<void> {
    this.isDestroyed = true;
  }

  isReady(): boolean {
    return !this.isDestroyed;
  }

  onError?(error: Error): void;

  protected handleError(error: Error, context: string): void {
    if (this.onError) {
      this.onError(error);
    } else {
      console.error(`[${this.name} Transport Error] ${context}:`, error);
    }
  }
}

/**
 * Console transport for browser and Node.js
 * @extends BaseTransport
 */
export class ConsoleTransport extends BaseTransport {
  private readonly useColors: boolean;

  constructor(
    options: {
      formatter?: Formatter;
      useColors?: boolean;
    } = {}
  ) {
    super("console", options.formatter ?? formatters.console);
    this.useColors = options.useColors ?? true;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    try {
      const formatted = this.formatter.format(entry);

      // Use appropriate console method based on log level
      switch (entry.level) {
        case 1: // ERROR
          console.error(formatted);
          break;
        case 2: // WARN
          console.warn(formatted);
          break;
        case 3: // INFO
          console.info(formatted);
          break;
        case 4: // HTTP
        case 5: // VERBOSE
        case 6: // DEBUG
        case 7: // SILLY
          console.log(formatted);
          break;
        default:
          console.log(formatted);
      }
    } catch (error) {
      this.handleError(error as Error, "writing to console");
    }
  }
}

/**
 * File transport for Node.js environments
 * @extends BaseTransport
 */
export class FileTransport extends BaseTransport {
  private readonly filename: string;
  private readonly maxSize: number;
  private readonly maxFiles: number;
  private writeStream?: WritableStream;
  private currentSize = 0;

  constructor(options: {
    filename: string;
    formatter?: Formatter;
    maxSize?: number;
    maxFiles?: number;
  }) {
    super("file", options.formatter ?? formatters.json);
    this.filename = options.filename;
    this.maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles ?? 5;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    try {
      // This is a simplified implementation - in real usage, you'd use fs
      const formatted = this.formatter.format(entry) + "\n";

      // Check if rotation is needed
      if (this.currentSize + formatted.length > this.maxSize) {
        await this.rotateFiles();
      }

      // Write to file (placeholder - would use actual file system)
      console.log(`[FILE: ${this.filename}] ${formatted}`);
      this.currentSize += formatted.length;
    } catch (error) {
      this.handleError(error as Error, "writing to file");
    }
  }

  private async rotateFiles(): Promise<void> {
    // File rotation logic (placeholder)
    this.currentSize = 0;
    console.log(`[FILE: ${this.filename}] Rotating log files`);
  }

  async close(): Promise<void> {
    if (this.writeStream) {
      // Close stream (placeholder)
    }
    await super.close();
  }
}

/**
 * Stream transport for custom streams
 * @extends BaseTransport
 */
export class StreamTransport extends BaseTransport {
  private readonly stream: WritableStream;

  constructor(options: { stream: WritableStream; formatter?: Formatter }) {
    super("stream", options.formatter ?? formatters.json);
    this.stream = options.stream;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    try {
      const formatted = this.formatter.format(entry) + "\n";
      const writer = this.stream.getWriter();
      await writer.write(new TextEncoder().encode(formatted));
      writer.releaseLock();
    } catch (error) {
      this.handleError(error as Error, "writing to stream");
    }
  }

  async close(): Promise<void> {
    try {
      await this.stream.close();
    } catch (error) {
      this.handleError(error as Error, "closing stream");
    }
    await super.close();
  }
}

/**
 * HTTP transport for remote logging
 * @extends BaseTransport
 */
export class HttpTransport extends BaseTransport {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private batch: LogEntry[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(options: {
    url: string;
    headers?: Record<string, string>;
    formatter?: Formatter;
    batchSize?: number;
    flushInterval?: number;
  }) {
    super("http", options.formatter ?? formatters.json);
    this.url = options.url;
    this.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    this.batchSize = options.batchSize ?? 10;
    this.flushInterval = options.flushInterval ?? 5000;

    this.startFlushTimer();
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    this.batch.push(entry);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const entries = [...this.batch];
    this.batch = [];

    try {
      const payload = entries.map((entry) => this.formatter.format(entry));

      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ logs: payload }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.handleError(error as Error, "sending HTTP batch");
      // Put entries back in batch for retry
      this.batch.unshift(...entries);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) =>
        this.handleError(error, "flushing HTTP batch")
      );
    }, this.flushInterval);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
    await super.close();
  }
}

/**
 * Memory transport for testing
 * @extends BaseTransport
 */
export class MemoryTransport extends BaseTransport {
  private readonly logs: string[] = [];
  private readonly maxLogs: number;

  constructor(
    options: {
      formatter?: Formatter;
      maxLogs?: number;
    } = {}
  ) {
    super("memory", options.formatter ?? formatters.simple);
    this.maxLogs = options.maxLogs ?? 1000;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    try {
      const formatted = this.formatter.format(entry);
      this.logs.push(formatted);

      // Keep only the most recent logs
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    } catch (error) {
      this.handleError(error as Error, "writing to memory");
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs.length = 0;
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

/**
 * Null transport for disabling output
 * @extends BaseTransport
 */
export class NullTransport extends BaseTransport {
  constructor() {
    super("null");
  }

  async write(_entry: LogEntry): Promise<void> {
    // Do nothing
  }
}

/**
 * Multi transport to fan out to multiple destinations
 * @extends BaseTransport
 */
export class MultiTransport extends BaseTransport {
  private readonly transports: Transport[];

  constructor(transports: Transport[]) {
    super("multi");
    this.transports = transports;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.isReady()) return;

    // Write to all transports concurrently
    const promises = this.transports.map((transport) =>
      transport
        .write(entry)
        .catch((error) =>
          this.handleError(error, `writing to ${transport.name}`)
        )
    );

    await Promise.allSettled(promises);
  }

  async close(): Promise<void> {
    const promises = this.transports.map((transport) =>
      transport
        .close?.()
        .catch((error) => this.handleError(error, `closing ${transport.name}`))
    );

    await Promise.allSettled(promises);
    await super.close();
  }

  isReady(): boolean {
    return (
      super.isReady() && this.transports.some((t) => t.isReady?.() ?? true)
    );
  }
}

/** Factory function to create transports */
export const createTransport = (
  type: "console" | "file" | "stream" | "http" | "memory" | "null",
  options?: Record<string, unknown>
): Transport => {
  switch (type) {
    case "console":
      return new ConsoleTransport(options);
    case "file":
      return new FileTransport(options as { filename: string });
    case "stream":
      return new StreamTransport(options as { stream: WritableStream });
    case "http":
      return new HttpTransport(options as { url: string });
    case "memory":
      return new MemoryTransport(options);
    case "null":
      return new NullTransport();
    default:
      throw new Error(`Unknown transport type: ${type}`);
  }
};

/** Default transports */
export const transports = {
  console: new ConsoleTransport(),
  memory: new MemoryTransport(),
  null: new NullTransport(),
} as const satisfies Record<string, Transport>;
