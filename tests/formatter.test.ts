import { describe, it, expect } from "vitest";
import { SlackFormatter } from "../src/slack/formatter.js";

const URL = "http://localhost:3100";

describe("SlackFormatter", () => {
  const formatter = new SlackFormatter(URL);

  describe("issueCreated", () => {
    it("should format issue created message with all fields", () => {
      const result = formatter.issueCreated({
        id: "iss-001",
        title: "Fix login crash",
        description: "Users cannot login on mobile",
        status: "open",
        priority: "high",
        projectName: "Web App",
      });

      expect(result.text).toContain("Fix login crash");
      expect(result.blocks).toHaveLength(5);
      expect(result.blocks[0]).toMatchObject({
        type: "header",
        text: { text: expect.stringContaining("New issue created") },
      });
      expect(result.blocks[1]).toMatchObject({
        type: "section",
        text: {
          text: expect.stringContaining("Fix login crash"),
        },
      });
      expect(result.blocks[1]).toMatchObject({
        type: "section",
        text: {
          text: expect.stringContaining(`${URL}/issues/iss-001`),
        },
      });

      const fieldsBlock = result.blocks[2] as {
        type: string;
        fields: Array<{ type: string; text: string }>;
      };
      expect(fieldsBlock.fields).toHaveLength(3);

      const actionsBlock = result.blocks[4] as {
        type: string;
        elements: Array<{ type: string; url: string }>;
      };
      expect(actionsBlock.type).toBe("actions");
      expect(actionsBlock.elements[0].url).toBe(`${URL}/issues/iss-001`);
    });

    it("should handle missing optional fields", () => {
      const result = formatter.issueCreated({
        id: "iss-002",
        title: "Simple issue",
      });

      expect(result.blocks).toHaveLength(3);
    });

    it("should truncate long descriptions", () => {
      const longDesc = "a".repeat(600);
      const result = formatter.issueCreated({
        id: "iss-003",
        title: "Long desc",
        description: longDesc,
      });

      const descBlock = result.blocks[2] as { text: { text: string } };
      expect(descBlock.text.text.length).toBeLessThan(600);
      expect(descBlock.text.text.endsWith("...")).toBe(true);
    });
  });

  describe("issueCommentCreated", () => {
    it("should format comment message", () => {
      const result = formatter.issueCommentCreated({
        issueId: "iss-001",
        issueTitle: "Fix login crash",
        author: "Jane Smith",
        body: "I can reproduce this on iOS",
      });

      expect(result.text).toContain("Jane Smith");
      expect(result.blocks).toHaveLength(4);
      expect(result.blocks[0]).toMatchObject({
        type: "header",
        text: { text: expect.stringContaining("New comment") },
      });
    });
  });

  describe("issueStatusChanged", () => {
    it("should format status change with old and new status", () => {
      const result = formatter.issueStatusChanged({
        issueId: "iss-001",
        issueTitle: "Fix login crash",
        oldStatus: "open",
        newStatus: "in_progress",
        changedBy: "Agent BuilderBot",
      });

      expect(result.text).toContain("open");
      expect(result.text).toContain("in_progress");
      expect(result.blocks).toHaveLength(4);

      const fieldsBlock = result.blocks[2] as {
        fields: Array<{ text: string }>;
      };
      const statusChange = fieldsBlock.fields.map((f) => f.text);
      expect(statusChange[0]).toContain("open");
      expect(statusChange[1]).toContain("in_progress");
      expect(statusChange[2]).toContain("Agent BuilderBot");
    });
  });

  describe("approvalCreated", () => {
    it("should format approval created message", () => {
      const result = formatter.approvalCreated({
        id: "app-001",
        issueId: "iss-001",
        issueTitle: "Deploy to production",
        approver: "Manager Alice",
        comment: "Please review before release",
      });

      expect(result.text).toContain("Deploy to production");
      expect(result.blocks).toHaveLength(5);
      expect(result.blocks[0]).toMatchObject({
        type: "header",
        text: { text: expect.stringContaining("Approval requested") },
      });
    });

    it("should handle minimal approval created", () => {
      const result = formatter.approvalCreated({
        id: "app-002",
      });

      expect(result.blocks).toHaveLength(2);
    });
  });

  describe("approvalDecided", () => {
    it("should format approval decided message with decision", () => {
      const result = formatter.approvalDecided({
        id: "app-001",
        issueId: "iss-001",
        issueTitle: "Deploy to production",
        approver: "Manager Alice",
        decision: "approved",
        comment: "Looks good",
      });

      expect(result.text).toContain("approved");
      expect(result.blocks).toHaveLength(5);
      expect(result.blocks[0]).toMatchObject({
        type: "header",
        text: { text: expect.stringContaining("Approval approved") },
      });
    });
  });

  describe("agentRunFailed", () => {
    it("should format agent error message with run ID", () => {
      const result = formatter.agentRunFailed({
        agentId: "agent-001",
        agentName: "BuilderBot",
        error: "Out of memory: container killed",
        runId: "run-123",
      });

      expect(result.text).toContain("BuilderBot");
      expect(result.text).toContain("Out of memory");
      expect(result.blocks).toHaveLength(5);

      const runIdBlock = result.blocks[2] as {
        fields: Array<{ text: string }>;
      };
      expect(runIdBlock.fields[0].text).toContain("run-123");
    });

    it("should handle error without runId", () => {
      const result = formatter.agentRunFailed({
        agentId: "agent-002",
        agentName: "TesterBot",
        error: "Connection refused",
      });

      expect(result.blocks).toHaveLength(4);
    });
  });

  describe("paperclipUrl handling", () => {
    it("should strip trailing slash from URL", () => {
      const fm = new SlackFormatter("http://example.com/");
      const result = fm.issueCreated({
        id: "iss-001",
        title: "Test",
      });

      const buttonBlock = result.blocks[2] as {
        elements: Array<{ url: string }>;
      };
      expect(buttonBlock.elements[0].url).toBe(
        "http://example.com/issues/iss-001",
      );
    });
  });
});
