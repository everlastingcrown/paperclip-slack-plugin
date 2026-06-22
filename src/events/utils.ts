import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";

type UnknownRecord = Record<string, unknown>;

export interface IssueSnapshot {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  projectName?: string;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

export function getPayloadRecord(event: PluginEvent): UnknownRecord | undefined {
  return isRecord(event.payload) ? event.payload : undefined;
}

export function getPayloadString(
  event: PluginEvent,
  ...paths: string[]
): string | undefined {
  const payload = getPayloadRecord(event);
  for (const path of paths) {
    const value = asString(nestedValue(payload, path));
    if (value) return value;
  }

  return undefined;
}

export function getEventString(
  event: PluginEvent,
  ...payloadKeys: string[]
): string | undefined {
  if (event.entityId) return event.entityId;

  return getPayloadString(event, ...payloadKeys);
}

function pickRecord(...values: unknown[]): UnknownRecord | undefined {
  return values.find(isRecord);
}

export function getIssueSnapshot(event: PluginEvent): IssueSnapshot | undefined {
  const payload = getPayloadRecord(event);
  const issue = pickRecord(
    payload?.issue,
    nestedValue(payload, "data.issue"),
    payload?.after,
    payload?.current,
    payload,
  );

  const id =
    event.entityType === "issue" ? asString(event.entityId) : undefined;
  const issueId =
    id ??
    getPayloadString(event, "issueId", "issue.id", "data.issue.id", "id");
  if (!issueId) return undefined;

  return {
    id: issueId,
    title: asString(issue?.title) ?? `Issue ${issueId}`,
    description: asString(issue?.description),
    status: asString(issue?.status),
    priority: asString(issue?.priority),
    projectId: asString(issue?.projectId),
    projectName:
      asString(nestedValue(issue, "project.name")) ??
      asString(nestedValue(payload, "project.name")) ??
      asString(payload?.projectName),
  };
}

export async function resolveActorName(
  ctx: PluginContext,
  event: PluginEvent,
  companyId: string,
): Promise<string> {
  void ctx;
  void companyId;

  const actorName = getPayloadString(
    event,
    "actorName",
    "userName",
    "name",
    "actor.name",
    "user.name",
    "agent.name",
  );
  if (actorName) return actorName;

  if (!event.actorId) return "System";

  if (event.actorType === "agent") {
    return `Agent ${event.actorId}`;
  }

  if (event.actorType === "user") {
    return `User ${event.actorId}`;
  }

  if (event.actorType === "plugin") {
    return `Plugin ${event.actorId}`;
  }

  return event.actorId;
}
