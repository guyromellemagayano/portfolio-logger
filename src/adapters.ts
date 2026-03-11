/**
 * Logger Adapters for Popular Libraries
 * Integrates your custom logger with Morgan, Pino, Winston, etc.
 */

import type { ILogger, LogLevel } from "./types";
import { parseLogLevel } from "./utils";

/** Morgan stream adapter for your custom logger */
export class MorganAdapter {
  constructor(private logger: ILogger) {}

  write(message: string): void {
    // Remove trailing newline and log as HTTP level
    this.logger.http(message.trim());
  }
}

/** Console adapter that redirects console.* to your logger */
export class ConsoleAdapter {
  private originalConsole: Console;

  constructor(private logger: ILogger) {
    this.originalConsole = { ...console };
  }

  /** Patch console methods to use your logger */
  patch(): void {
    console.log = (...args) => this.logger.info(this.formatArgs(args));
    console.info = (...args) => this.logger.info(this.formatArgs(args));
    console.warn = (...args) => this.logger.warn(this.formatArgs(args));
    console.error = (...args) => this.logger.error(this.formatArgs(args));
    console.debug = (...args) => this.logger.debug(this.formatArgs(args));
  }

  /** Restore original console methods */
  restore(): void {
    Object.assign(console, this.originalConsole);
  }

  private formatArgs(args: unknown[]): string {
    return args
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");
  }
}

/** Winston-compatible interface adapter */
export class WinstonAdapter {
  constructor(private logger: ILogger) {}

  // Winston-style logging methods
  log(level: string, message: string, meta?: unknown): void {
    const logLevel = this.convertWinstonLevel(level);
    this.logger.log(logLevel, message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: unknown): void {
    this.logger.debug(message, meta);
  }

  private convertWinstonLevel(level: string): LogLevel {
    const mapping: Record<string, LogLevel> = {
      error: parseLogLevel("ERROR"),
      warn: parseLogLevel("WARN"),
      info: parseLogLevel("INFO"),
      http: parseLogLevel("HTTP"),
      verbose: parseLogLevel("VERBOSE"),
      debug: parseLogLevel("DEBUG"),
      silly: parseLogLevel("SILLY"),
    };
    return mapping[level] || parseLogLevel("INFO");
  }
}

/** Next.js App Router adapter */
export class NextJsAdapter {
  constructor(private logger: ILogger) {}

  /** Create middleware for Next.js API routes */
  middleware() {
    return async (req: any, res: any, next?: () => void) => {
      const start = Date.now();

      // Add logger to request
      req.logger = this.logger.child({
        requestId: req.headers["x-request-id"] || `nextjs_${Date.now()}`,
        component: "nextjs-api",
        metadata: {
          method: req.method,
          url: req.url,
          userAgent: req.headers["user-agent"],
        },
      });

      // Log request start
      req.logger.http("Request started", {
        method: req.method,
        url: req.url,
      });

      // Override res.end to log completion
      const originalEnd = res.end;

      res.end = function (chunk: any, encoding: any) {
        const duration = Date.now() - start;
        req.logger.http("Request completed", {
          statusCode: res.statusCode,
          duration,
          responseSize: chunk?.length || 0,
        });
        originalEnd.call(this, chunk, encoding);
      };

      if (next) next();
    };
  }
}

/** React error boundary adapter */
export class ReactErrorAdapter {
  constructor(private logger: ILogger) {}

  /** Log React errors with component context */
  logError(error: Error, errorInfo: { componentStack: string }): void {
    this.logger.error("React component error", error, {
      component: "react-error-boundary",
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });
  }

  /** Log React warnings */
  logWarning(message: string, componentStack?: string): void {
    this.logger.warn(
      "React warning",
      {
        warning: message,
        componentStack,
      },
      {
        component: "react-dev-warning",
      }
    );
  }
}

/** Vite/Webpack build adapter */
export class BuildAdapter {
  constructor(
    private logger: ILogger,
    private tool: "vite" | "webpack" | "next"
  ) {}

  /** Log build events */
  logBuild(event: "start" | "success" | "error", data?: unknown): void {
    const level = event === "error" ? "error" : "info";

    this.logger[level](`Build ${event}`, data, {
      component: `${this.tool}-build`,
      metadata: {
        buildTool: this.tool,
        buildEvent: event,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /** Log compilation warnings/errors */
  logCompilation(
    type: "warning" | "error",
    message: string,
    file?: string
  ): void {
    const level = type === "error" ? "error" : "warn";

    this.logger[level](
      `Compilation ${type}`,
      {
        message,
        file,
      },
      {
        component: `${this.tool}-compiler`,
        metadata: {
          compilationType: type,
          sourceFile: file,
        },
      }
    );
  }
}

/** Create adapters for common use cases */
export const createAdapters = (logger: ILogger) => ({
  morgan: new MorganAdapter(logger),
  console: new ConsoleAdapter(logger),
  winston: new WinstonAdapter(logger),
  nextjs: new NextJsAdapter(logger),
  react: new ReactErrorAdapter(logger),
  vite: new BuildAdapter(logger, "vite"),
  webpack: new BuildAdapter(logger, "webpack"),
  next: new BuildAdapter(logger, "next"),
});

/** Utility to patch global console for universal logging */
export const patchGlobalConsole = (logger: ILogger): (() => void) => {
  const adapter = new ConsoleAdapter(logger);
  adapter.patch();

  // Return cleanup function
  return () => adapter.restore();
};
