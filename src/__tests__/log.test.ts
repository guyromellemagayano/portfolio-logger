import { describe, expect, it, vi } from "vitest";

import { log } from "..";

// Spy on console.info since the enhanced logger uses info level
vi.spyOn(global.console, "info");

describe("@portfolio/logger", () => {
  it("prints a message using enhanced logger", () => {
    log("hello");

    // The enhanced logger now logs to console.info with a different format
    expect(console.info).toHaveBeenCalled();

    // Check that the call contains our message

    const calls = (console.info as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain("hello");
  });
});
