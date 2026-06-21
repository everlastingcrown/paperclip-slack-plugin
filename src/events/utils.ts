import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";

export async function resolveActorName(
  ctx: PluginContext,
  event: PluginEvent,
  companyId: string,
): Promise<string> {
  if (!event.actorId) return "System";

  if (event.actorType === "agent") {
    try {
      const agent = await ctx.agents.get(event.actorId, companyId);
      if (agent) {
        return agent.name ?? `Agent ${event.actorId}`;
      }
      return `Agent ${event.actorId}`;
    } catch {
      return `Agent ${event.actorId}`;
    }
  }

  if (event.actorType === "user") {
    const payload = event.payload as Record<string, unknown> | undefined;
    const userName =
      (payload?.actorName as string) ??
      (payload?.userName as string) ??
      (payload?.name as string);
    if (userName) return userName;
    return `User ${event.actorId}`;
  }

  if (event.actorType === "plugin") {
    return `Plugin ${event.actorId}`;
  }

  return event.actorId;
}
