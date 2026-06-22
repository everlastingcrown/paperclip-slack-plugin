import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import type { Issue } from "@paperclipai/shared";

const mockPostMessage = vi.fn();
const mockConversationsList = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
    conversations: { list: mockConversationsList },
  })),
}));

import plugin from "../src/worker.js";
import manifest from "../src/manifest.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockConversationsList.mockResolvedValue({
    ok: true,
    channels: [{ id: "C001", name: "general" }],
    response_metadata: {},
  });
  mockPostMessage.mockResolvedValue({
    ok: true,
    ts: "1234567890.123",
    channel: "C001",
  });
});

describe("worker event delivery", () => {
  it("posts a Slack notification for issue.created events", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.created": { enabled: true, channels: ["#general"] },
        },
      },
    });

    harness.seed({
      issues: [
        {
          id: "iss_1",
          companyId: "company-test",
          projectId: null,
          projectWorkspaceId: null,
          goalId: null,
          parentId: null,
          title: "Test issue",
          description: "Created from the event harness",
          status: "open",
          workMode: "plan_then_execute",
          priority: "normal",
          assigneeAgentId: null,
          assigneeUserId: null,
          checkoutRunId: null,
          executionRunId: null,
          executionAgentNameKey: null,
          executionLockedAt: null,
          createdByAgentId: null,
          createdByUserId: null,
          issueNumber: null,
          identifier: null,
          requestDepth: 0,
          billingCode: null,
          assigneeAdapterOverrides: null,
          executionWorkspaceId: null,
          executionWorkspacePreference: null,
          executionWorkspaceSettings: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          hiddenAt: null,
          createdAt: new Date("2026-06-22T00:00:00Z"),
          updatedAt: new Date("2026-06-22T00:00:00Z"),
        } as Issue,
      ],
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.created",
      { issueId: "iss_1" },
      { entityId: "iss_1", entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: "New issue created: Test issue",
      }),
    );
  });

  it("uses payload.issueId when issue.created has no entityId", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.created": { enabled: true, channels: ["#general"] },
        },
      },
    });

    harness.seed({
      issues: [
        {
          id: "iss_payload",
          companyId: "company-test",
          projectId: null,
          projectWorkspaceId: null,
          goalId: null,
          parentId: null,
          title: "Payload issue",
          description: null,
          status: "open",
          workMode: "plan_then_execute",
          priority: "normal",
          assigneeAgentId: null,
          assigneeUserId: null,
          checkoutRunId: null,
          executionRunId: null,
          executionAgentNameKey: null,
          executionLockedAt: null,
          createdByAgentId: null,
          createdByUserId: null,
          issueNumber: null,
          identifier: null,
          requestDepth: 0,
          billingCode: null,
          assigneeAdapterOverrides: null,
          executionWorkspaceId: null,
          executionWorkspacePreference: null,
          executionWorkspaceSettings: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          hiddenAt: null,
          createdAt: new Date("2026-06-22T00:00:00Z"),
          updatedAt: new Date("2026-06-22T00:00:00Z"),
        } as Issue,
      ],
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.created",
      { issueId: "iss_payload" },
      { entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: "New issue created: Payload issue",
      }),
    );
  });
});
