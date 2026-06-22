import type { Block, KnownBlock } from "@slack/types";

export interface IssueInfo {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  projectName?: string;
}

export interface CommentInfo {
  issueId: string;
  issueTitle: string;
  author: string;
  body: string;
}

export interface StatusChangeInfo {
  issueId: string;
  issueTitle: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
}

export interface ApprovalInfo {
  id: string;
  issueId?: string;
  issueTitle?: string;
  approver?: string;
  decision?: string;
  comment?: string;
}

export interface AgentErrorInfo {
  agentId: string;
  agentName: string;
  error: string;
  runId?: string;
}

export class SlackFormatter {
  private paperclipUrl: string | null;

  constructor(paperclipUrl: string) {
    this.paperclipUrl = this.normalizeBaseUrl(paperclipUrl);
  }

  private normalizeBaseUrl(value: string): string | null {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return null;

    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString().replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  private issueUrl(issueId: string): string | null {
    if (!this.paperclipUrl) return null;
    return `${this.paperclipUrl}/issues/${issueId}`;
  }

  private agentUrl(agentId: string): string | null {
    if (!this.paperclipUrl) return null;
    return `${this.paperclipUrl}/agents/${agentId}`;
  }

  private linkedText(url: string | null, label: string): string {
    return url ? `<${url}|${label}>` : label;
  }

  private viewButton(
    url: string | null,
    actionId: string,
  ): KnownBlock | null {
    if (!url) return null;
    return {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View in Paperclip", emoji: true },
          url,
          action_id: actionId,
        },
      ],
    };
  }

  issueCreated(info: IssueInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = `New issue created: ${info.title}`;
    const fields: { type: "mrkdwn"; text: string }[] = [];

    if (info.projectName) {
      fields.push({ type: "mrkdwn", text: `*Project:*\n${info.projectName}` });
    }
    if (info.priority) {
      fields.push({ type: "mrkdwn", text: `*Priority:*\n${info.priority}` });
    }
    if (info.status) {
      fields.push({ type: "mrkdwn", text: `*Status:*\n${info.status}` });
    }

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `New issue created`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${this.linkedText(this.issueUrl(info.id), info.title)}*`,
        },
      },
    ];

    if (fields.length > 0) {
      blocks.push({ type: "section", fields });
    }

    if (info.description) {
      const truncated =
        info.description.length > 500
          ? info.description.substring(0, 500) + "..."
          : info.description;
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: truncated },
      });
    }

    const button = this.viewButton(this.issueUrl(info.id), "view-issue");
    if (button) blocks.push(button);

    return { text, blocks };
  }

  issueCommentCreated(info: CommentInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = `New comment on "${info.issueTitle}" by ${info.author}`;
    const body = info.body.trim();
    const truncatedBody =
      body.length > 500
        ? body.substring(0, 500) + "..."
        : body;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "New comment",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${info.author}* commented on *${this.linkedText(
            this.issueUrl(info.issueId),
            info.issueTitle,
          )}*`,
        },
      },
    ];

    if (truncatedBody) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: truncatedBody },
      });
    }

    const button = this.viewButton(this.issueUrl(info.issueId), "view-issue");
    if (button) blocks.push(button);

    return { text, blocks };
  }

  issueStatusChanged(info: StatusChangeInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = `Issue "${info.issueTitle}" status changed: ${info.oldStatus} → ${info.newStatus}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Status changed",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${this.linkedText(
            this.issueUrl(info.issueId),
            info.issueTitle,
          )}*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*From:*\n${info.oldStatus}`,
          },
          {
            type: "mrkdwn",
            text: `*To:*\n${info.newStatus}`,
          },
          {
            type: "mrkdwn",
            text: `*Changed by:*\n${info.changedBy}`,
          },
        ],
      },
    ];

    const button = this.viewButton(this.issueUrl(info.issueId), "view-issue");
    if (button) blocks.push(button);

    return { text, blocks };
  }

  approvalCreated(info: ApprovalInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const issueRef =
      info.issueId && info.issueTitle
        ? `*${this.linkedText(this.issueUrl(info.issueId), info.issueTitle)}*`
        : `Issue ${info.issueId}`;
    const text = `Approval requested for ${info.issueTitle ?? info.issueId}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Approval requested",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `An approval has been requested for ${issueRef}`,
        },
      },
    ];

    if (info.approver) {
      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Approver:*\n${info.approver}` },
        ],
      });
    }

    if (info.comment) {
      const truncated =
        info.comment.length > 500
          ? info.comment.substring(0, 500) + "..."
          : info.comment;
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: truncated },
      });
    }

    if (info.issueId) {
      const button = this.viewButton(this.issueUrl(info.issueId), "view-issue");
      if (button) blocks.push(button);
    }

    return { text, blocks };
  }

  approvalDecided(info: ApprovalInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const decision = info.decision ?? "decided";
    const issueRef =
      info.issueId && info.issueTitle
        ? `*${this.linkedText(this.issueUrl(info.issueId), info.issueTitle)}*`
        : `Issue ${info.issueId}`;
    const text = `Approval ${decision} for ${info.issueTitle ?? info.issueId}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Approval ${decision}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `An approval has been *${decision}* for ${issueRef}`,
        },
      },
    ];

    if (info.approver) {
      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Approver:*\n${info.approver}` },
        ],
      });
    }

    if (info.comment) {
      const truncated =
        info.comment.length > 500
          ? info.comment.substring(0, 500) + "..."
          : info.comment;
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: truncated },
      });
    }

    if (info.issueId) {
      const button = this.viewButton(this.issueUrl(info.issueId), "view-issue");
      if (button) blocks.push(button);
    }

    return { text, blocks };
  }

  agentRunFailed(info: AgentErrorInfo): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = `Agent "${info.agentName}" run failed: ${info.error}`;
    const truncatedError =
      info.error.length > 500
        ? info.error.substring(0, 500) + "..."
        : info.error;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Agent run failed",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Agent:* ${this.linkedText(
            this.agentUrl(info.agentId),
            info.agentName,
          )}`,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Error:*\n\`\`\`${truncatedError}\`\`\`` },
      },
    ];

    if (info.runId) {
      blocks.splice(2, 0, {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Run ID:*\n\`${info.runId}\`` },
        ],
      });
    }

    const button = this.viewButton(this.agentUrl(info.agentId), "view-agent");
    if (button) blocks.push(button);

    return { text, blocks };
  }
}
