/**
 * Comprehensive Logger Tests
 * Tests all major functionality including levels, transports, formatters, and performance
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLogger,
  formatters,
  generateId,
  JsonFormatter,
  log,
  type Logger,
  LogLevel,
  MemoryTransport,
  parseLogLevel,
  sanitizeData,
  shouldLog,
  SimpleFormatter,
} from "..";

describe("Logger System", () => {
  let logger: Logger;
  let memoryTransport: MemoryTransport;

  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    logger = createLogger({
      level: LogLevel.DEBUG,
      transports: [memoryTransport],
      enabled: true,
    }) as Logger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Logger Creation", () => {
    it("creates logger with default config", () => {
      const defaultLogger = createLogger();
      expect(defaultLogger).toBeDefined();
      expect(defaultLogger.setLevel).toBeInstanceOf(Function);
    });

    it("creates logger with custom config", () => {
      const customLogger = createLogger({
        level: LogLevel.ERROR,
        enabled: false,
      });
      expect(customLogger).toBeDefined();
    });

    it("creates child logger with context", () => {
      const parent = createLogger();
      const child = parent.child({ component: "test-component" });
      expect(child).toBeDefined();
      expect(child).not.toBe(parent);
    });
  });

  describe("Log Levels", () => {
    it("logs error messages", () => {
      logger.error("Test error message");
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("ERROR");
      expect(logs[0]).toContain("Test error message");
    });

    it("logs warn messages", () => {
      logger.warn("Test warning message");
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("WARN");
    });

    it("logs info messages", () => {
      logger.info("Test info message");
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("INFO");
    });

    it("logs debug messages", () => {
      logger.debug("Test debug message");
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("DEBUG");
    });

    it("respects log level filtering", () => {
      logger.setLevel(LogLevel.ERROR);
      logger.debug("Should not appear");
      logger.info("Should not appear");
      logger.error("Should appear");

      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("Should appear");
    });

    it("supports string log levels", () => {
      logger.log("ERROR", "String level test");
      const logs = memoryTransport.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("ERROR");
    });
  });

  describe("Data Logging", () => {
    it("logs with additional data", () => {
      logger.info("Test with data", { userId: 123, action: "login" });
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("userId");
      expect(logs[0]).toContain("123");
    });

    it("logs error objects", () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error);
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("Test error");
    });

    it("sanitizes sensitive data", () => {
      logger.info("User data", {
        username: "john",
        password: "secret123",
        token: "abc123",
      });
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("REDACTED");
      expect(logs[0]).not.toContain("secret123");
    });
  });

  describe("Context", () => {
    it("includes context in logs", () => {
      logger.setContext({ component: "auth-service", requestId: "req-123" });
      logger.info("Context test");
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("auth-service");
    });

    it("merges contexts correctly", () => {
      logger.setContext({ component: "service-a" });
      logger.info("Test message", {}, { requestId: "req-456" });
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("service-a");
      expect(logs[0]).toContain("req-456");
    });

    it("child logger inherits context", () => {
      logger.setContext({ userId: "main", component: "auth" });
      const child = logger.child({ component: "sub-module" });
      child.info("Child test");
      const logs = memoryTransport.getLogs();
      expect(logs[0]).toContain("main");
      expect(logs[0]).toContain("sub-module");
    });
  });

  describe("Performance Monitoring", () => {
    it("measures execution time", async () => {
      logger.time("test-operation");
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));
      logger.timeEnd("test-operation");
      const logs = memoryTransport.getLogs();
      expect(logs.some((log) => log.includes("test-operation"))).toBe(true);
      expect(logs.some((log) => log.includes("completed"))).toBe(true);
    });

    it("handles non-existent timers", () => {
      logger.timeEnd("non-existent");
      const logs = memoryTransport.getLogs();
      expect(logs.some((log) => log.includes("does not exist"))).toBe(true);
    });
  });

  describe("Metrics", () => {
    it("records counter metrics", () => {
      logger.counter("user.login", 1, { method: "oauth" });
      // Metrics are logged at debug level
      const logs = memoryTransport.getLogs();
      expect(logs.some((log) => log.includes("counter user.login=1"))).toBe(
        true
      );
    });

    it("records gauge metrics", () => {
      logger.gauge("memory.usage", 85.5);
      const logs = memoryTransport.getLogs();
      expect(logs.some((log) => log.includes("gauge memory.usage=85.5"))).toBe(
        true
      );
    });

    it("records histogram metrics", () => {
      logger.histogram("response.time", 150);
      const logs = memoryTransport.getLogs();
      expect(
        logs.some((log) => log.includes("histogram response.time=150"))
      ).toBe(true);
    });
  });

  describe("Transports", () => {
    it("supports multiple transports", () => {
      const transport1 = new MemoryTransport();
      const transport2 = new MemoryTransport();

      const multiLogger = createLogger({
        transports: [transport1, transport2],
      }) as Logger;

      multiLogger.info("Multi-transport test");

      expect(transport1.getLogs()).toHaveLength(1);
      expect(transport2.getLogs()).toHaveLength(1);
    });

    it("adds and removes transports", () => {
      // Create a transport with a different name
      const newTransport = new MemoryTransport();
      // Override the name to avoid conflict
      (newTransport as any).name = "newMemory";

      logger.addTransport(newTransport);

      logger.info("Transport test");

      expect(memoryTransport.getLogs()).toHaveLength(1);
      expect(newTransport.getLogs()).toHaveLength(1);

      logger.removeTransport("memory");
      memoryTransport.clear();
      newTransport.clear();

      logger.info("After removal");
      expect(memoryTransport.getLogs()).toHaveLength(0);
      expect(newTransport.getLogs()).toHaveLength(1);
    });
  });

  describe("Error Handling", () => {
    it("handles transport errors gracefully", () => {
      const faultyTransport = {
        name: "faulty",
        write: vi.fn().mockRejectedValue(new Error("Transport error")),
        isReady: () => true,
      };

      logger.addTransport(faultyTransport);

      // Should not throw
      expect(() => {
        logger.info("Test with faulty transport");
      }).not.toThrow();
    });

    it("continues logging when transport fails", () => {
      const workingTransport = new MemoryTransport();
      const faultyTransport = {
        name: "faulty",
        write: vi.fn().mockRejectedValue(new Error("Transport error")),
        isReady: () => true,
      };

      const testLogger = createLogger({
        transports: [workingTransport, faultyTransport],
      }) as Logger;

      testLogger.info("Test message");

      expect(workingTransport.getLogs()).toHaveLength(1);
    });
  });

  describe("Lifecycle", () => {
    it("flushes transports", async () => {
      const flushSpy = vi.fn();
      const flushableTransport = {
        name: "flushable",
        write: vi.fn(),
        flush: flushSpy,
        isReady: () => true,
      };

      logger.addTransport(flushableTransport);
      await logger.flush();

      expect(flushSpy).toHaveBeenCalled();
    });

    it("closes transports", async () => {
      const closeSpy = vi.fn();
      const closeableTransport = {
        name: "closeable",
        write: vi.fn(),
        close: closeSpy,
        isReady: () => true,
      };

      logger.addTransport(closeableTransport);
      await logger.close();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});

describe("Formatters", () => {
  let entry: any;

  beforeEach(() => {
    entry = {
      level: LogLevel.INFO,
      message: "Test message",
      timestamp: new Date("2024-01-01T00:00:00.000Z"),
      context: { component: "test" },
      data: { key: "value" },
    };
  });

  it("JSON formatter works correctly", () => {
    const formatter = new JsonFormatter();
    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.level).toBe("INFO");
    expect(parsed.message).toBe("Test message");
    expect(parsed.context.component).toBe("test");
  });

  it("Simple formatter works correctly", () => {
    const formatter = new SimpleFormatter();
    const formatted = formatter.format(entry);

    expect(formatted).toContain("INFO");
    expect(formatted).toContain("Test message");
    expect(formatted).toContain("test");
  });

  it("Console formatter includes colors", () => {
    const formatter = formatters.console;
    const formatted = formatter.format(entry);

    expect(formatted).toContain("INFO");
    expect(formatted).toContain("Test message");
  });
});

describe("Utilities", () => {
  describe("parseLogLevel", () => {
    it("parses numeric levels", () => {
      expect(parseLogLevel(LogLevel.INFO)).toBe(LogLevel.INFO);
    });

    it("parses string levels", () => {
      expect(parseLogLevel("ERROR")).toBe(LogLevel.ERROR);
      expect(parseLogLevel("INFO")).toBe(LogLevel.INFO);
    });

    it("throws on invalid levels", () => {
      expect(() => parseLogLevel("INVALID" as any)).toThrow();
    });
  });

  describe("shouldLog", () => {
    it("determines correct logging behavior", () => {
      expect(shouldLog(LogLevel.INFO, LogLevel.ERROR)).toBe(true);
      expect(shouldLog(LogLevel.INFO, LogLevel.DEBUG)).toBe(false);
      expect(shouldLog(LogLevel.SILENT, LogLevel.ERROR)).toBe(false);
    });
  });

  describe("generateId", () => {
    it("generates unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe("sanitizeData", () => {
    it("redacts sensitive fields", () => {
      const data = {
        username: "john",
        password: "secret",
        apiKey: "key123",
        token: "token456",
      };

      const sanitized = sanitizeData(data) as any;

      expect(sanitized.username).toBe("john");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
    });

    it("handles circular references", () => {
      const obj: any = { name: "test" };
      obj.self = obj;

      expect(() => sanitizeData(obj)).not.toThrow();
    });

    it("handles different data types", () => {
      expect(sanitizeData("string")).toBe("string");
      expect(sanitizeData(123)).toBe(123);
      expect(sanitizeData(true)).toBe(true);
      expect(sanitizeData(null)).toBe(null);
      expect(sanitizeData(undefined)).toBe(undefined);
    });
  });
});

describe("Legacy API", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("supports legacy log function", () => {
    log("Legacy test");
    // Legacy functions use the default logger which outputs to console
    expect(consoleSpy).toHaveBeenCalled();
  });
});
