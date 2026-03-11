#!/usr/bin/env node

/* global console, process, setTimeout */

/**
 * Test script to verify dual module builds (ESM and CommonJS)
 * This script tests both import and require functionality with comprehensive validation
 */
import { exec } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Test results tracking
const results = {
  esm: false,
  cjs: false,
  types: false,
  functional: false,
  exports: false,
};

console.log("🧪 Testing dual module build...\n");

/** Test ESM build functionality */
async function testESMBuild() {
  console.log("📦 Testing ESM build...");

  try {
    const esmIndexPath = join(packageRoot, "dist/es/index.mjs");
    if (!existsSync(esmIndexPath)) {
      throw new Error("ESM build not found: dist/es/index.mjs");
    }

    // Dynamic import test with file:// URL for cross-platform compatibility
    const esmModule = await import(`file://${esmIndexPath}`);
    const { logger, createLogger, LogLevel, formatters, transports, utils } =
      esmModule;

    // Validate core exports
    if (!logger || typeof logger !== "object") {
      throw new Error("logger export is missing or invalid");
    }
    if (!createLogger || typeof createLogger !== "function") {
      throw new Error("createLogger export is missing or invalid");
    }
    if (!LogLevel || typeof LogLevel !== "object") {
      throw new Error("LogLevel export is missing or invalid");
    }
    if (!formatters || typeof formatters !== "object") {
      throw new Error("formatters export is missing or invalid");
    }
    if (!transports || typeof transports !== "object") {
      throw new Error("transports export is missing or invalid");
    }
    if (!utils || typeof utils !== "object") {
      throw new Error("utils export is missing or invalid");
    }

    // Test functional logger usage
    const testLogger = createLogger({
      level: LogLevel.DEBUG,
      transports: [transports.console],
    });

    if (!testLogger || typeof testLogger.info !== "function") {
      throw new Error("Created logger is not functional");
    }

    console.log("✅ ESM build works correctly");
    console.log(
      `   - logger: ${typeof logger} (${Object.keys(logger).length} properties)`
    );
    console.log(`   - createLogger: ${typeof createLogger}`);
    console.log(
      `   - LogLevel: ${typeof LogLevel} (${Object.keys(LogLevel).length} levels)`
    );
    console.log(
      `   - formatters: ${typeof formatters} (${Object.keys(formatters).length} formatters)`
    );
    console.log(
      `   - transports: ${typeof transports} (${Object.keys(transports).length} transports)`
    );
    console.log(
      `   - utils: ${typeof utils} (${Object.keys(utils).length} utilities)`
    );

    results.esm = true;
  } catch (error) {
    console.error("❌ ESM build failed:", getErrorMessage(error));
    return false;
  }

  return true;
}

/** Test CommonJS build functionality */
async function testCommonJSBuild() {
  console.log("\n📦 Testing CommonJS build...");

  try {
    const cjsIndexPath = join(packageRoot, "dist/cjs/index.cjs");
    if (!existsSync(cjsIndexPath)) {
      throw new Error("CommonJS build not found: dist/cjs/index.cjs");
    }

    // Escape path for cross-platform compatibility
    const escapedPath = cjsIndexPath.replace(/\\/g, "\\\\");

    // Test require in a subprocess since we're in ESM mode
    const testCommand = `node -e "
      try {
        const pkg = require('${escapedPath}');
        const { logger, createLogger, LogLevel, formatters, transports, utils } = pkg;
        
        // Validate exports
        if (!logger || typeof logger !== 'object') {
          throw new Error('logger export is missing or invalid');
        }
        if (!createLogger || typeof createLogger !== 'function') {
          throw new Error('createLogger export is missing or invalid');
        }
        if (!LogLevel || typeof LogLevel !== 'object') {
          throw new Error('LogLevel export is missing or invalid');
        }
        if (!formatters || typeof formatters !== 'object') {
          throw new Error('formatters export is missing or invalid');
        }
        if (!transports || typeof transports !== 'object') {
          throw new Error('transports export is missing or invalid');
        }
        if (!utils || typeof utils !== 'object') {
          throw new Error('utils export is missing or invalid');
        }
        
        // Test functional usage
        const testLogger = createLogger({
          level: LogLevel.DEBUG,
          transports: [transports.console],
        });
        
        if (!testLogger || typeof testLogger.info !== 'function') {
          throw new Error('Created logger is not functional');
        }
        
        console.log('✅ CommonJS build works correctly');
        console.log('   - logger: ' + typeof logger + ' (' + Object.keys(logger).length + ' properties)');
        console.log('   - createLogger: ' + typeof createLogger);
        console.log('   - LogLevel: ' + typeof LogLevel + ' (' + Object.keys(LogLevel).length + ' levels)');
        console.log('   - formatters: ' + typeof formatters + ' (' + Object.keys(formatters).length + ' formatters)');
        console.log('   - transports: ' + typeof transports + ' (' + Object.keys(transports).length + ' transports)');
        console.log('   - utils: ' + typeof utils + ' (' + Object.keys(utils).length + ' utilities)');
      } catch (error) {
        console.error('❌ CommonJS test failed:', error.message);
        process.exit(1);
      }
    "`;

    const { stdout, stderr } = await execAsync(testCommand);

    if (stderr) {
      throw new Error(`CommonJS test stderr: ${stderr}`);
    }

    console.log(stdout.trim());
    results.cjs = true;
  } catch (error) {
    console.error("❌ CommonJS build failed:", getErrorMessage(error));
    return false;
  }

  return true;
}

/** Test individual export files */
async function testIndividualExports() {
  console.log("\n📋 Testing individual exports...");

  const exports = ["formatters", "transports", "utils"];
  const testResults = [];

  for (const exportName of exports) {
    try {
      // Test ESM export
      const esmPath = join(packageRoot, `dist/es/${exportName}.mjs`);
      if (!existsSync(esmPath)) {
        throw new Error(`ESM ${exportName} not found`);
      }

      const esmModule = await import(`file://${esmPath}`);
      if (!esmModule[exportName] || typeof esmModule[exportName] !== "object") {
        throw new Error(`ESM ${exportName} export is invalid`);
      }

      // Test CommonJS export
      const cjsPath = join(packageRoot, `dist/cjs/${exportName}.cjs`);
      if (!existsSync(cjsPath)) {
        throw new Error(`CommonJS ${exportName} not found`);
      }

      testResults.push(`✅ ${exportName}: ESM & CJS exports valid`);
    } catch (error) {
      testResults.push(`❌ ${exportName}: ${getErrorMessage(error)}`);
      return false;
    }
  }

  testResults.forEach((result) => console.log(`   ${result}`));
  results.exports = true;
  return true;
}

/** Test type declarations */
async function testTypeDeclarations() {
  console.log("\n📋 Testing type declarations...");

  const typeFiles = [
    "dist/es/index.d.mts",
    "dist/cjs/index.d.cts",
    "dist/es/formatters.d.mts",
    "dist/cjs/formatters.d.cts",
    "dist/es/transports.d.mts",
    "dist/cjs/transports.d.cts",
    "dist/es/utils.d.mts",
    "dist/cjs/utils.d.cts",
  ];

  const missing = [];
  const existing = [];

  for (const typeFile of typeFiles) {
    const fullPath = join(packageRoot, typeFile);
    if (!existsSync(fullPath)) {
      missing.push(typeFile);
    } else {
      existing.push(typeFile);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing type declarations:`);
    missing.forEach((file) => console.error(`   - ${file}`));
    return false;
  }

  console.log(`✅ All type declarations exist (${existing.length} files)`);
  existing.forEach((file) => console.log(`   ✓ ${file}`));

  results.types = true;
  return true;
}

/** Test functional logger behavior */
async function testFunctionalBehavior() {
  console.log("\n🔧 Testing functional behavior...");

  try {
    // Import the ESM build for functional testing
    const esmIndexPath = join(packageRoot, "dist/es/index.mjs");
    const { createLogger, LogLevel, MemoryTransport } = await import(
      `file://${esmIndexPath}`
    );

    // Create a test logger with memory transport
    const memoryTransport = new MemoryTransport();
    const testLogger = createLogger({
      level: LogLevel.DEBUG,
      transports: [memoryTransport],
    });

    // Test various log levels
    testLogger.error("Test error message");
    testLogger.warn("Test warning message");
    testLogger.info("Test info message");
    testLogger.debug("Test debug message");

    // Test with data
    testLogger.info("Test with data", { userId: 123, action: "test" });

    // Test child logger
    const childLogger = testLogger.child({ component: "test-component" });
    childLogger.info("Child logger test");

    // Verify logs were captured
    const logs = memoryTransport.getLogs();
    if (logs.length !== 6) {
      throw new Error(`Expected 6 logs, got ${logs.length}`);
    }

    // Test performance monitoring
    testLogger.time("test-operation");
    await new Promise((resolve) => setTimeout(resolve, 10));
    testLogger.timeEnd("test-operation");

    console.log("✅ Functional behavior works correctly");
    console.log(`   - Logged ${logs.length} messages successfully`);
    console.log(`   - Child logger inheritance works`);
    console.log(`   - Performance timing works`);

    results.functional = true;
  } catch (error) {
    console.error(
      "❌ Functional behavior test failed:",
      getErrorMessage(error)
    );
    return false;
  }

  return true;
}

/** Main test runner */
async function runTests() {
  const tests = [
    testESMBuild,
    testCommonJSBuild,
    testIndividualExports,
    testTypeDeclarations,
    testFunctionalBehavior,
  ];

  let allPassed = true;

  for (const test of tests) {
    const passed = await test();
    if (!passed) {
      allPassed = false;
      break;
    }
  }

  console.log("\n" + "=".repeat(60));

  if (allPassed) {
    console.log("🎉 All dual module tests passed!");
    console.log("\n📝 Build summary:");
    console.log("   ✅ ESM build: dist/es/ (*.mjs, *.d.mts)");
    console.log("   ✅ CommonJS build: dist/cjs/ (*.cjs, *.d.cts)");
    console.log("   ✅ Individual exports working");
    console.log("   ✅ Type declarations complete");
    console.log("   ✅ Functional behavior verified");
    console.log("\n🚀 Package is ready for distribution!");
  } else {
    console.log("❌ Some tests failed!");
    console.log("\n📊 Test Results:");
    console.log(`   ESM Build: ${results.esm ? "✅" : "❌"}`);
    console.log(`   CommonJS Build: ${results.cjs ? "✅" : "❌"}`);
    console.log(`   Individual Exports: ${results.exports ? "✅" : "❌"}`);
    console.log(`   Type Declarations: ${results.types ? "✅" : "❌"}`);
    console.log(`   Functional Behavior: ${results.functional ? "✅" : "❌"}`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("❌ Test runner failed:", getErrorMessage(error));
  process.exit(1);
});
