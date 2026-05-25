import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockBotExists = true;
let mockWebhookExists = true;
let mockBotContent = "";
let mockWebhookContent = "";

vi.mock("fs", () => {
  const mock = {
    existsSync: vi.fn((filePath: unknown) => {
      if (String(filePath).endsWith("bot.ts")) return mockBotExists;
      if (String(filePath).endsWith("webhook.ts")) return mockWebhookExists;
      return true;
    }),
    readFileSync: vi.fn((filePath: unknown) => {
      if (String(filePath).endsWith("bot.ts")) return mockBotContent;
      if (String(filePath).endsWith("webhook.ts")) return mockWebhookContent;
      return "";
    }),
  };
  return { ...mock, default: mock };
});

async function loadScript() {
  const exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation(() => undefined as never);
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../scripts/check-command-parity");
  return { exitSpy, consoleSpy, errorSpy };
}

describe("check-command-parity", () => {
  beforeEach(() => {
    mockBotExists = true;
    mockWebhookExists = true;
    mockBotContent = "";
    mockWebhookContent = "";
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when source files are missing", () => {
    it("exits with code 2 when both files are missing", async () => {
      mockBotExists = false;
      mockWebhookExists = false;

      const { exitSpy, errorSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unable to locate"),
      );
    });

    it("exits with code 2 when only bot.ts is missing", async () => {
      mockBotExists = false;

      const { exitSpy, errorSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unable to locate"),
      );
    });

    it("exits with code 2 when only webhook.ts is missing", async () => {
      mockWebhookExists = false;

      const { exitSpy, errorSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unable to locate"),
      );
    });
  });

  describe("when commands match between both files", () => {
    it("exits with code 0 and reports parity OK", async () => {
      const content =
        "bot.command('start', handler);\nbot.command('help', handler);\nbot.command('list_events', handler);";
      mockBotContent = content;
      mockWebhookContent = content;

      const { exitSpy, consoleSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Command parity OK"),
      );
    });

    it("lists all matched commands in the output", async () => {
      const content =
        "bot.command('start', handler);\nbot.command('help', handler);";
      mockBotContent = content;
      mockWebhookContent = content;

      const { consoleSpy } = await loadScript();

      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toContain("start");
      expect(output).toContain("help");
    });
  });

  describe("when commands are missing in webhook.ts", () => {
    it("exits with code 1 and reports which commands are missing", async () => {
      mockBotContent =
        "bot.command('start', h);\nbot.command('new_command', h);";
      mockWebhookContent = "bot.command('start', h);";

      const { exitSpy, consoleSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toContain("new_command");
      expect(output).toContain("MISSING in api/webhook.ts");
    });
  });

  describe("when webhook.ts has extra commands not in bot.ts", () => {
    it("exits with code 1 and reports which commands are extra", async () => {
      mockBotContent = "bot.command('start', h);";
      mockWebhookContent =
        "bot.command('start', h);\nbot.command('ghost_command', h);";

      const { exitSpy, consoleSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toContain("ghost_command");
      expect(output).toContain("NOT in src/bot.ts");
    });
  });

  describe("when both files have mismatches in both directions", () => {
    it("exits with code 1 and reports both missing and extra commands", async () => {
      mockBotContent = "bot.command('start', h);\nbot.command('bot_only', h);";
      mockWebhookContent =
        "bot.command('start', h);\nbot.command('webhook_only', h);";

      const { exitSpy, consoleSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = consoleSpy.mock.calls.flat().join(" ");
      expect(output).toContain("bot_only");
      expect(output).toContain("MISSING in api/webhook.ts");
      expect(output).toContain("webhook_only");
      expect(output).toContain("NOT in src/bot.ts");
    });
  });

  describe("command extraction", () => {
    it("ignores commented-out and non-bot.command lines", async () => {
      mockBotContent =
        "bot.command('start', handler);\n// bot.command('commented_out', handler);\nconst x = someOtherBot.command('ignored', handler);";
      mockWebhookContent = "bot.command('start', handler);";

      const { exitSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("deduplicates repeated commands in the same file", async () => {
      const content =
        "bot.command('start', handler);\nbot.command('start', anotherHandler);";
      mockBotContent = content;
      mockWebhookContent = content;

      const { exitSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("treats two empty files as parity OK", async () => {
      mockBotContent = "";
      mockWebhookContent = "";

      const { exitSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("ignores bot.command calls with an empty command name", async () => {
      const content = "bot.command('', handler);";
      mockBotContent = content;
      mockWebhookContent = content;

      const { exitSpy } = await loadScript();

      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });
});
