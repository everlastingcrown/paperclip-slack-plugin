import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";

type UnknownRecord = Record<string, unknown>;

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

export async function resolveActorName(
  ctx: PluginContext,
  event: PluginEvent,
  companyId: string,
): Promise<string> {
  const actorName = getPayloadString(
    event,
    "actorName",
    "actorDisplayName",
    "userName",
    "userDisplayName",
    "displayName",
    "name",
    "actor.name",
    "actor.displayName",
    "user.name",
    "user.displayName",
    "author.name",
    "author.displayName",
    "comment.author.name",
    "comment.author.displayName",
    "data.author.name",
    "data.author.displayName",
    "agent.name",
    "agent.displayName",
  );
  if (actorName) return actorName;

  if (!event.actorId) return "System";

  if (event.actorType === "agent") {
    try {
      const agent = await ctx.agents.get(event.actorId, companyId);
      if (agent?.name) return agent.name;
    } catch (e: any) {
      ctx.logger.warn("Could not resolve agent actor name", {
        actorId: event.actorId,
        companyId,
        error: e.message,
      });
    }

    return `Agent ${event.actorId}`;
  }

  if (event.actorType === "user") {
    return "A user";
  }

  if (event.actorType === "plugin") {
    return `Plugin ${event.actorId}`;
  }

  return event.actorId;
}
