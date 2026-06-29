import type { PluginEvent } from "@paperclipai/plugin-sdk";
import {
  asString,
  getPayloadRecord,
  getPayloadString,
  isRecord,
} from "./utils.js";

type UnknownRecord = Record<string, unknown>;

interface PaperclipPluginActivityPayload extends UnknownRecord {
  sourcePluginId?: unknown;
  sourcePluginKey?: unknown;
  initiatingActorType?: unknown;
  initiatingActorId?: unknown;
  initiatingAgentId?: unknown;
  initiatingUserId?: unknown;
  initiatingRunId?: unknown;
  pluginId?: unknown;
  pluginKey?: unknown;
  agentId?: unknown;
  runId?: unknown;
}

interface PaperclipIssueCreatedPayload extends PaperclipPluginActivityPayload {
  title?: unknown;
  identifier?: unknown;
  originKind?: unknown;
  originId?: unknown;
  billingCode?: unknown;
  blockedByIssueIds?: unknown;
}

interface PaperclipIssueUpdatedPayload extends PaperclipPluginActivityPayload {
  identifier?: unknown;
  patch?: UnknownRecord;
  _previous?: {
    status?: unknown;
    assigneeAgentId?: unknown;
    assigneeUserId?: unknown;
  };
}

interface PaperclipIssueCommentCreatedPayload extends PaperclipPluginActivityPayload {
  identifier?: unknown;
  commentId?: unknown;
  bodySnippet?: unknown;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; details?: Record<string, unknown> };

export interface NormalizedIssue {
  id: string;
  title: string;
  description?: string;
  status?: string;
  previousStatus?: string;
  priority?: string;
  projectId?: string;
  projectName?: string;
}

export interface NormalizedIssueComment {
  commentId?: string;
  issueId: string;
  issueTitle: string;
  body: string;
}

export interface NormalizedApproval {
  id: string;
  issueId?: string;
  issueTitle?: string;
  decision?: string;
  comment?: string;
}

export interface NormalizedAgentRun {
  runId: string;
  agentId: string;
  agentName: string;
  error?: string;
}

export interface NormalizedBudgetIncident {
  id: string;
  title: string;
  severity?: string;
  status?: string;
  amount?: string;
  budget?: string;
}

function nestedValue(source: unknown, path: string): unknown {
  if (!isRecord(source)) return undefined;

  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return current;
}

function pickRecord(...values: unknown[]): UnknownRecord | undefined {
  return values.find(isRecord);
}

function payloadKeys(event: PluginEvent): string[] {
  const payload = getPayloadRecord(event);
  return payload ? Object.keys(payload).sort() : [];
}

function parseFailure(
  reason: string,
  event: PluginEvent,
  details: Record<string, unknown> = {},
): ParseResult<never> {
  return {
    ok: false,
    reason,
    details: {
      ...details,
      payloadKeys: payloadKeys(event),
    },
  };
}

function issueRecord(event: PluginEvent): UnknownRecord | undefined {
  const payload = getPayloadRecord(event);
  return pickRecord(
    payload?.issue,
    nestedValue(payload, "data.issue"),
    payload?.after,
    payload?.current,
  );
}

function paperclipIssueCreatedPayload(
  event: PluginEvent,
): PaperclipIssueCreatedPayload | undefined {
  return getPayloadRecord(event) as PaperclipIssueCreatedPayload | undefined;
}

function paperclipIssueUpdatedPayload(
  event: PluginEvent,
): PaperclipIssueUpdatedPayload | undefined {
  return getPayloadRecord(event) as PaperclipIssueUpdatedPayload | undefined;
}

function paperclipIssueCommentCreatedPayload(
  event: PluginEvent,
): PaperclipIssueCommentCreatedPayload | undefined {
  return getPayloadRecord(event) as PaperclipIssueCommentCreatedPayload | undefined;
}

function issueIdFromEvent(event: PluginEvent): string | undefined {
  return event.entityType === "issue" ? asString(event.entityId) : undefined;
}

function normalizeIssueFromRecord(
  event: PluginEvent,
): ParseResult<NormalizedIssue> {
  const payload = getPayloadRecord(event);
  const createdPayload = paperclipIssueCreatedPayload(event);
  const updatedPayload = paperclipIssueUpdatedPayload(event);
  const issue = issueRecord(event);
  const issueId =
    issueIdFromEvent(event) ??
    asString(issue?.id) ??
    getPayloadString(event, "issueId", "data.issueId");

  if (!issueId) {
    return parseFailure("Could not determine issue ID.", event, {
      entityId: event.entityId,
      entityType: event.entityType,
    });
  }

  return {
    ok: true,
    value: {
      id: issueId,
      title:
        asString(issue?.title) ??
        asString(payload?.title) ??
        asString(createdPayload?.identifier) ??
        asString(updatedPayload?.identifier) ??
        getPayloadString(event, "issueTitle", "data.issueTitle") ??
        `Issue ${issueId}`,
      description: asString(issue?.description),
      status:
        asString(issue?.status) ??
        asString(updatedPayload?.patch?.status) ??
        getPayloadString(event, "status", "data.status"),
      previousStatus: getPayloadString(
        event,
        "_previous.status",
        "data._previous.status",
        "before.status",
        "previous.status",
      ),
      priority:
        asString(issue?.priority) ??
        getPayloadString(event, "priority", "data.priority"),
      projectId:
        asString(issue?.projectId) ??
        getPayloadString(event, "projectId", "data.projectId"),
      projectName:
        asString(nestedValue(issue, "project.name")) ??
        asString(nestedValue(payload, "project.name")) ??
        asString(payload?.projectName),
    },
  };
}

export function parseIssueCreated(
  event: PluginEvent,
): ParseResult<NormalizedIssue> {
  return normalizeIssueFromRecord(event);
}

export function parseIssueLifecycle(
  event: PluginEvent,
): ParseResult<NormalizedIssue> {
  return normalizeIssueFromRecord(event);
}

export function parseIssueStatusUpdate(
  event: PluginEvent,
): ParseResult<NormalizedIssue> {
  return normalizeIssueFromRecord(event);
}

export function parseIssueCommentCreated(
  event: PluginEvent,
): ParseResult<NormalizedIssueComment> {
  const paperclipPayload = paperclipIssueCommentCreatedPayload(event);
  const issueId =
    issueIdFromEvent(event) ??
    getPayloadString(
      event,
      "issueId",
      "data.issueId",
      "data.comment.issue.id",
      "comment.issueId",
      "data.comment.issueId",
      "comment.issue.id",
      "issueComment.issueId",
      "issueComment.issue.id",
      "parentIssue.id",
    );

  if (!issueId) {
    return parseFailure("Could not determine issue ID for comment.", event, {
      entityId: event.entityId,
      entityType: event.entityType,
    });
  }

  const body =
    getPayloadString(
      event,
      "body",
      "bodySnippet",
      "content",
      "text",
      "markdown",
      "message",
      "comment",
      "data.body",
      "data.content",
      "data.text",
      "data.markdown",
      "data.message",
      "data.comment",
      "comment.body",
      "comment.content",
      "comment.text",
      "comment.markdown",
      "comment.message",
      "data.comment.body",
      "data.comment.content",
      "data.comment.text",
      "data.comment.markdown",
      "data.comment.message",
      "issueComment.body",
      "issueComment.content",
      "issueComment.text",
      "issueComment.markdown",
      "issueComment.message",
    ) ?? "";

  return {
    ok: true,
    value: {
      commentId:
        asString(paperclipPayload?.commentId) ??
        (event.entityType === "issue_comment" ? asString(event.entityId) : undefined),
      issueId,
      issueTitle:
        asString(paperclipPayload?.identifier) ??
        getPayloadString(
          event,
          "issueTitle",
          "data.issueTitle",
          "issue.title",
          "data.issue.title",
          "comment.issue.title",
        ) ?? `Issue ${issueId}`,
      body,
    },
  };
}

export function parseApproval(
  event: PluginEvent,
  kind: "created" | "decided",
): ParseResult<NormalizedApproval> {
  const approvalId = asString(event.entityId);
  if (!approvalId) {
    return parseFailure("Could not determine approval ID.", event, {
      entityId: event.entityId,
      entityType: event.entityType,
    });
  }

  return {
    ok: true,
    value: {
      id: approvalId,
      issueId: getPayloadString(
        event,
        "issueId",
        "data.issueId",
        "issue.id",
        "data.issue.id",
        "approval.issueId",
      ),
      issueTitle: getPayloadString(
        event,
        "issueTitle",
        "data.issueTitle",
        "issue.title",
        "data.issue.title",
        "approval.issue.title",
      ),
      decision:
        kind === "decided"
          ? getPayloadString(event, "decision", "outcome", "approval.decision")
          : undefined,
      comment: getPayloadString(
        event,
        "comment",
        "reason",
        "description",
        "approval.comment",
      ),
    },
  };
}

export function parseAgentRun(
  event: PluginEvent,
): ParseResult<NormalizedAgentRun> {
  const runId =
    event.entityType === "run" ? asString(event.entityId) : undefined;
  const agentId =
    getPayloadString(
      event,
      "agentId",
      "data.agentId",
      "agent.id",
      "data.agent.id",
      "run.agentId",
      "data.run.agentId",
      "run.agent.id",
      "data.run.agent.id",
    ) ??
    (event.entityType === "agent" ? asString(event.entityId) : undefined);

  if (!runId && !agentId) {
    return parseFailure("Could not determine run or agent ID.", event, {
      entityId: event.entityId,
      entityType: event.entityType,
    });
  }

  const resolvedAgentId = agentId ?? "unknown-agent";

  return {
    ok: true,
    value: {
      runId:
        runId ??
        getPayloadString(event, "runId", "data.runId", "run.id", "data.run.id") ??
        "unknown-run",
      agentId: resolvedAgentId,
      agentName:
        getPayloadString(
          event,
          "agentName",
          "data.agentName",
          "agent.name",
          "agent.displayName",
          "data.agent.name",
          "data.agent.displayName",
          "run.agent.name",
          "run.agent.displayName",
          "data.run.agent.name",
          "data.run.agent.displayName",
        ) ??
        `Agent ${resolvedAgentId}`,
      error: getPayloadString(
        event,
        "error",
        "message",
        "reason",
        "run.error",
        "data.run.error",
      ),
    },
  };
}

export function parseBudgetIncident(
  event: PluginEvent,
): ParseResult<NormalizedBudgetIncident> {
  const payload = getPayloadRecord(event);
  const incident = pickRecord(
    payload?.incident,
    payload?.budgetIncident,
    nestedValue(payload, "data.incident"),
    nestedValue(payload, "data.budgetIncident"),
    payload,
  );
  const incidentId =
    event.entityType === "budget_incident" ? asString(event.entityId) : undefined;
  const id =
    incidentId ??
    asString(incident?.id) ??
    getPayloadString(event, "incidentId", "budgetIncidentId", "data.incidentId");

  if (!id) {
    return parseFailure("Could not determine budget incident ID.", event, {
      entityId: event.entityId,
      entityType: event.entityType,
    });
  }

  return {
    ok: true,
    value: {
      id,
      title:
        asString(incident?.title) ??
        asString(incident?.name) ??
        getPayloadString(event, "title", "name", "data.title") ??
        `Budget incident ${id}`,
      severity: asString(incident?.severity),
      status: asString(incident?.status),
      amount:
        asString(incident?.amount) ??
        asString(incident?.cost) ??
        getPayloadString(event, "amount", "cost", "data.amount"),
      budget:
        asString(incident?.budget) ??
        asString(nestedValue(incident, "budget.name")) ??
        getPayloadString(event, "budgetName", "data.budgetName"),
    },
  };
}
