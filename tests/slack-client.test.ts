import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthTest = vi.fn();
const mockPostMessage = vi.fn();
const mockConversationsList = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: { test: mockAuthTest },
    chat: { postMessage: mockPostMessage },
    conversations: { list: mockConversationsList },
  })),
  WebApiRateLimitedError: class extends Error {},
}));

import { SlackClient } from "../src/slack/client.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SlackClient", () => {
  describe("authTest", () => {
    it("should return ok and user_id on success", async () => {
      mockAuthTest.mockResolvedValueOnce({
        ok: true,
        user_id: "U123",
        team_id: "T123",
      });

      const client = new SlackClient("xoxb-test-token");
      const result = await client.authTest();

      expect(result.ok).toBe(true);
      expect(result.user_id).toBe("U123");
      expect(mockAuthTest).toHaveBeenCalledTimes(1);
    });

    it("should throw on failure", async () => {
      mockAuthTest.mockRejectedValueOnce(new Error("invalid_auth"));

      const client = new SlackClient("xoxb-test-token");
      await expect(client.authTest()).rejects.toThrow("invalid_auth");
    });
  });

  describe("postMessage", () => {
    it("should post message to channel with blocks", async () => {
      mockPostMessage.mockResolvedValueOnce({
        ok: true,
        ts: "1234567890.123",
        channel: "C123",
      });

      const client = new SlackClient("xoxb-test-token");
      const blocks = [
        {
          type: "header" as const,
          text: { type: "plain_text" as const, text: "Test" },
        },
      ];

      const result = await client.postMessage("C123", "Test message", blocks);

      expect(result.ts).toBe("1234567890.123");
      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: "C123",
        text: "Test message",
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });
    });
  });

  describe("listChannels", () => {
    it("should return channel list", async () => {
      mockConversationsList.mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: "C001", name: "general" },
          { id: "C002", name: "random" },
        ],
        response_metadata: {},
      });

      const client = new SlackClient("xoxb-test-token");
      const channels = await client.listChannels();

      expect(channels).toHaveLength(2);
      expect(channels[0]).toEqual({ id: "C001", name: "general" });
      expect(mockConversationsList).toHaveBeenCalledWith({
        types: "public_channel",
        exclude_archived: true,
        limit: 200,
        cursor: undefined,
      });
    });

    it("should handle pagination", async () => {
      mockConversationsList
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "C001", name: "page1" }],
          response_metadata: { next_cursor: "cursor2" },
        })
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "C002", name: "page2" }],
          response_metadata: {},
        });

      const client = new SlackClient("xoxb-test-token");
      const channels = await client.listChannels();

      expect(channels).toHaveLength(2);
      expect(mockConversationsList).toHaveBeenCalledTimes(2);
    });
  });

  describe("resolveChannel", () => {
    it("should return channel ID if already an ID", async () => {
      const client = new SlackClient("xoxb-test-token");
      const result = await client.resolveChannel("C123ABC");

      expect(result).toBe("C123ABC");
    });

    it("should return private channel ID if already an ID", async () => {
      const client = new SlackClient("xoxb-test-token");
      const result = await client.resolveChannel("G123ABC");

      expect(result).toBe("G123ABC");
      expect(mockConversationsList).not.toHaveBeenCalled();
    });

    it("should resolve channel name to ID", async () => {
      mockConversationsList.mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: "C001", name: "general" },
          { id: "C002", name: "random" },
        ],
        response_metadata: {},
      });

      const client = new SlackClient("xoxb-test-token");
      const result = await client.resolveChannel("#general");

      expect(result).toBe("C001");
      expect(mockConversationsList).toHaveBeenCalledTimes(1);
    });

    it("should resolve private channel name to ID", async () => {
      mockConversationsList
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "C001", name: "general" }],
          response_metadata: {},
        })
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "G001", name: "leadership" }],
          response_metadata: {},
        });

      const client = new SlackClient("xoxb-test-token");
      const result = await client.resolveChannel("#leadership");

      expect(result).toBe("G001");
      expect(mockConversationsList).toHaveBeenNthCalledWith(2, {
        types: "private_channel",
        exclude_archived: true,
        limit: 200,
        cursor: undefined,
      });
    });

    it("should return null for unknown channel", async () => {
      mockConversationsList
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "C001", name: "general" }],
          response_metadata: {},
        })
        .mockResolvedValueOnce({
          ok: true,
          channels: [{ id: "G001", name: "leadership" }],
          response_metadata: {},
        });

      const client = new SlackClient("xoxb-test-token");
      const result = await client.resolveChannel("#nonexistent");

      expect(result).toBeNull();
    });
  });
});
