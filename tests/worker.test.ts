import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthTest = vi.fn();
const mockPostMessage = vi.fn();
const mockConversationsList = vi.fn();

vi.mock("@paperclipai/plugin-sdk", () => ({
  definePlugin: vi.fn((plugin) => plugin),
  runWorker: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: { test: mockAuthTest },
    chat: { postMessage: mockPostMessage },
    conversations: { list: mockConversationsList },
  })),
}));

import plugin from "../src/worker.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("worker config validation", () => {
  it("sends test messages to unique channels from enabled events", async () => {
    mockAuthTest.mockResolvedValueOnce({
      ok: true,
      user_id: "U123",
      team_id: "T123",
    });
    mockConversationsList.mockResolvedValue({
      ok: true,
      channels: [
        { id: "C001", name: "general" },
        { id: "C002", name: "alerts" },
        { id: "C003", name: "disabled" },
      ],
      response_metadata: {},
    });
    mockPostMessage.mockResolvedValue({
      ok: true,
      ts: "1234567890.123",
      channel: "C001",
    });

    const result = await plugin.onValidateConfig({
      slackBotToken: "xoxb-test-token",
      events: {
        "issue.created": { enabled: true, channels: ["#general"] },
        "issue.comment.created": { enabled: true, channels: ["#general"] },
        "issue.statusChanged": { enabled: false, channels: ["#disabled"] },
        "approval.created": { enabled: true, channels: ["#alerts"] },
        "approval.decided": { enabled: true, channels: [] },
        "agent.run.failed": { enabled: false, channels: ["#alerts"] },
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenNthCalledWith(1, {
      channel: "C001",
      text: "Paperclip Slack plugin test: hello world",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Paperclip Slack plugin test: hello world",
          },
        },
      ],
      unfurl_links: false,
      unfurl_media: false,
    });
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ channel: "C002" }),
    );
  });

  it("fails validation when a test message cannot be sent", async () => {
    mockAuthTest.mockResolvedValueOnce({ ok: true });
    mockConversationsList.mockResolvedValue({
      ok: true,
      channels: [{ id: "C001", name: "general" }],
      response_metadata: {},
    });
    mockPostMessage.mockRejectedValueOnce(new Error("missing_scope"));

    const result = await plugin.onValidateConfig({
      slackBotToken: "xoxb-test-token",
      events: {
        "issue.created": { enabled: true, channels: ["#general"] },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'Could not send test message to "#general": missing_scope',
    ]);
  });
});
