import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";

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

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.created",
      {
        issue: {
          id: "iss_1",
          title: "Test issue",
          description: "Created from the event harness",
          status: "open",
          priority: "normal",
        },
      },
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

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.created",
      { issueId: "iss_payload", title: "Payload issue" },
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

  it("posts issue.created from Paperclip plugin-host activity details", async () => {
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

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.created",
      {
        title: "Fix release notes",
        identifier: "ENG-42",
        originKind: "plugin:test",
        originId: "origin_1",
        billingCode: "engineering",
        blockedByIssueIds: [],
        agentId: null,
        runId: null,
      },
      { entityId: "iss_42", entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: "New issue created: Fix release notes",
      }),
    );
  });

  it("uses nested issue IDs for issue.comment.created payloads", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        comment: {
          issueId: "iss_comment",
          body: "I can reproduce this",
        },
        issue: {
          title: "Comment target",
        },
        actorName: "Jane Smith",
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'New comment on "Comment target" by Jane Smith',
      }),
    );
    expect(JSON.stringify(mockPostMessage.mock.calls[0][0].blocks)).toContain(
      "I can reproduce this",
    );
  });

  it("posts issue comment text from data.body and resolves agent actor names", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });
    vi.spyOn(harness.ctx.agents, "get").mockResolvedValue({
      name: "BuilderBot",
    } as any);

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        data: {
          issueId: "iss_comment",
          body: "The fix is ready for review",
        },
        issueTitle: "Comment target",
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        actorId: "agent_1",
        actorType: "agent",
        companyId: "company-test",
      },
    );

    expect(harness.ctx.agents.get).toHaveBeenCalledWith(
      "agent_1",
      "company-test",
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'New comment on "Comment target" by BuilderBot',
      }),
    );
    expect(JSON.stringify(mockPostMessage.mock.calls[0][0].blocks)).toContain(
      "The fix is ready for review",
    );
  });

  it("posts issue comment text from top-level comment payloads", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });
    const listComments = vi
      .spyOn(harness.ctx.issues, "listComments")
      .mockRejectedValue(new Error("missing invocation scope"));
    const agentsGet = vi
      .spyOn(harness.ctx.agents, "get")
      .mockRejectedValue(new Error("missing invocation scope"));

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        issueId: "iss_comment",
        issueTitle: "CI failed, version no longer exists",
        comment: "The failing version was removed from the registry.",
        agentName: "BuilderBot",
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        actorId: "cc240c02-5eb2-4f5f-8fef-905e676141b8",
        actorType: "agent",
        companyId: "company-test",
      },
    );

    expect(listComments).not.toHaveBeenCalled();
    expect(agentsGet).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text:
          'New comment on "CI failed, version no longer exists" by BuilderBot',
      }),
    );
    const blocks = JSON.stringify(mockPostMessage.mock.calls[0][0].blocks);
    expect(blocks).toContain("The failing version was removed from the registry.");
    expect(blocks).not.toContain("cc240c02-5eb2-4f5f-8fef-905e676141b8");
  });

  it("posts issue comments from Paperclip plugin-host activity details", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });
    const listComments = vi.spyOn(harness.ctx.issues, "listComments");

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        identifier: "CI failed, version no longer exists",
        commentId: "comment_1",
        bodySnippet: "The failing version was removed from the registry.",
        actorName: "BuilderBot",
        agentId: "agent_1",
        runId: null,
      },
      {
        entityId: "iss_comment",
        entityType: "issue",
        companyId: "company-test",
      },
    );

    expect(listComments).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text:
          'New comment on "CI failed, version no longer exists" by BuilderBot',
      }),
    );
    expect(JSON.stringify(mockPostMessage.mock.calls[0][0].blocks)).toContain(
      "The failing version was removed from the registry.",
    );
  });

  it("still posts issue comments when fallback SDK reads fail", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });
    vi.spyOn(harness.ctx.issues, "listComments").mockRejectedValue(
      new Error("missing invocation scope"),
    );
    vi.spyOn(harness.ctx.agents, "get").mockRejectedValue(
      new Error("missing invocation scope"),
    );

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        issueId: "iss_comment",
        issueTitle: "Comment target",
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        actorId: "agent_1",
        actorType: "agent",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'New comment on "Comment target" by Agent agent_1',
      }),
    );
  });

  it("fetches comment body when the issue.comment.created payload only has IDs", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });
    vi.spyOn(harness.ctx.issues, "listComments").mockResolvedValue([
      {
        id: "comment_1",
        issueId: "iss_comment",
        body: "Fetched from stored comment",
      } as any,
    ]);

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        issueId: "iss_comment",
        issueTitle: "Comment target",
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        actorId: "user_1",
        actorType: "user",
        companyId: "company-test",
      },
    );

    expect(harness.ctx.issues.listComments).toHaveBeenCalledWith(
      "iss_comment",
      "company-test",
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'New comment on "Comment target" by A user',
      }),
    );
    const blocks = JSON.stringify(mockPostMessage.mock.calls[0][0].blocks);
    expect(blocks).toContain("Fetched from stored comment");
    expect(blocks).not.toContain("user_1");
  });

  it("uses entityId for issue.comment.created when the entity is an issue", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        body: "I can reproduce this",
        actorName: "Jane Smith",
      },
      { entityId: "iss_comment", entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'New comment on "Issue iss_comment" by Jane Smith',
      }),
    );
  });

  it("detects issue status changes from issue.updated payloads", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.statusChanged": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.updated",
      { issue: { id: "iss_status", title: "Status target", status: "open" } },
      { entityId: "iss_status", entityType: "issue", companyId: "company-test" },
    );
    await harness.emit(
      "issue.updated",
      {
        issue: {
          id: "iss_status",
          title: "Status target",
          status: "in_progress",
        },
        actorName: "Jane Smith",
      },
      { entityId: "iss_status", entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: 'Issue "Status target" status changed: open → in_progress',
      }),
    );
  });

  it("detects issue status changes from top-level issue.updated payloads", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.statusChanged": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.updated",
      {
        _previous: { status: "open" },
        agentId: "agent_1",
        identifier: "CI failed, version no longer exists",
        runId: "run_1",
        status: "in_progress",
      },
      {
        entityId: "iss_status",
        entityType: "issue",
        actorName: "BuilderBot",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text:
          'Issue "CI failed, version no longer exists" status changed: open → in_progress',
      }),
    );
  });

  it("detects issue status changes from Paperclip plugin-host patch payloads", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.statusChanged": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.updated",
      {
        identifier: "CI failed, version no longer exists",
        patch: { status: "in_progress" },
        _previous: {
          status: "open",
          assigneeAgentId: null,
          assigneeUserId: null,
        },
        agentId: "agent_1",
        runId: "run_1",
      },
      {
        entityId: "iss_status",
        entityType: "issue",
        actorName: "BuilderBot",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text:
          'Issue "CI failed, version no longer exists" status changed: open → in_progress',
      }),
    );
  });

  it("posts a Slack error notification when an enabled event has an invalid payload", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.comment.created": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.comment.created",
      {
        comment: {
          body: "No issue reference",
        },
        target: {
          id: "ambiguous_target",
        },
      },
      {
        entityId: "comment_1",
        entityType: "issue_comment",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: "Paperclip Slack plugin could not process issue.comment.created",
      }),
    );
  });

  it("posts issue lifecycle notifications", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "issue.checked_out": { enabled: true, channels: ["#general"] },
          "issue.released": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "issue.checked_out",
      { issue: { id: "iss_lifecycle", title: "Lifecycle target" } },
      { entityId: "iss_lifecycle", entityType: "issue", companyId: "company-test" },
    );
    await harness.emit(
      "issue.released",
      { issue: { id: "iss_lifecycle", title: "Lifecycle target" } },
      { entityId: "iss_lifecycle", entityType: "issue", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: "C001",
        text: "Issue checked out: Lifecycle target",
      }),
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: "C001",
        text: "Issue released: Lifecycle target",
      }),
    );
  });

  it("posts agent run status notifications", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "agent.run.finished": { enabled: true, channels: ["#general"] },
          "agent.run.cancelled": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "agent.run.finished",
      {
        runId: "run_finished",
        agent: { id: "agent_1", name: "BuilderBot" },
      },
      { entityId: "run_finished", entityType: "run", companyId: "company-test" },
    );
    await harness.emit(
      "agent.run.cancelled",
      {
        runId: "run_cancelled",
        agent: { id: "agent_1", name: "BuilderBot" },
      },
      { entityId: "run_cancelled", entityType: "run", companyId: "company-test" },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: "C001",
        text: "Agent run finished: BuilderBot",
      }),
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: "C001",
        text: "Agent run cancelled: BuilderBot",
      }),
    );
  });

  it("uses top-level agent names for agent run notifications", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "agent.run.finished": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "agent.run.finished",
      {
        agentId: "cc240c02-5eb2-4f5f-8fef-905e676141b8",
        agentName: "BuilderBot",
        runId: "8d55438f-6203-4b2f-8bb9-cd02c68afeab",
      },
      {
        entityId: "8d55438f-6203-4b2f-8bb9-cd02c68afeab",
        entityType: "run",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C001",
        text: "Agent run finished: BuilderBot",
      }),
    );
    expect(JSON.stringify(mockPostMessage.mock.calls[0][0].blocks)).not.toContain(
      "Agent cc240c02-5eb2-4f5f-8fef-905e676141b8",
    );
  });

  it("posts budget incident notifications", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        slackBotToken: "xoxb-test-token",
        paperclipUrl: "https://paperclip.example",
        events: {
          "budget.incident.opened": { enabled: true, channels: ["#general"] },
          "budget.incident.resolved": { enabled: true, channels: ["#general"] },
        },
      },
    });

    await plugin.definition.setup(harness.ctx);
    await harness.emit(
      "budget.incident.opened",
      {
        incident: {
          id: "budget_1",
          title: "Monthly spend exceeded",
          severity: "high",
        },
      },
      {
        entityId: "budget_1",
        entityType: "budget_incident",
        companyId: "company-test",
      },
    );
    await harness.emit(
      "budget.incident.resolved",
      {
        incident: {
          id: "budget_1",
          title: "Monthly spend exceeded",
          status: "resolved",
        },
      },
      {
        entityId: "budget_1",
        entityType: "budget_incident",
        companyId: "company-test",
      },
    );

    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: "C001",
        text: "Budget incident opened: Monthly spend exceeded",
      }),
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: "C001",
        text: "Budget incident resolved: Monthly spend exceeded",
      }),
    );
  });
});
