import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";

export async function handleAgentRunFailed(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["agent.run.failed"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const companyId = event.companyId;

  try {
    const payload = event.payload as Record<string, unknown> | undefined;
    const agentId = (payload?.agentId as string) ?? event.entityId;
    const runId = (payload?.runId as string) ?? event.entityId;

    if (!agentId) return;

    let agentName = "Unknown agent";
    try {
      const agent = await ctx.agents.get(agentId, companyId);
      if (agent) {
        agentName = agent.name;
      } else {
        agentName = `Agent ${agentId}`;
      }
    } catch {
      agentName = `Agent ${agentId}`;
    }

    const errorMessage =
      (payload?.error as string) ??
      (payload?.message as string) ??
      (payload?.reason as string) ??
      "Unknown error";

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.agentRunFailed({
      agentId,
      agentName,
      error: errorMessage,
      runId,
    });

    const slack = new SlackClient(config.slackBotToken);

    for (const channel of eventCfg.channels) {
      try {
        const resolved = await slack.resolveChannel(channel);
        if (!resolved) {
          ctx.logger.warn("Channel not found for agent.run.failed", {
            channel,
            agentId,
          });
          continue;
        }
        await slack.postMessage(resolved, message.text, message.blocks);
        ctx.logger.info("Slack notification sent for agent.run.failed", {
          channel,
          agentId,
        });
      } catch (e: any) {
        ctx.logger.error(
          "Failed to send Slack notification for agent.run.failed",
          {
            channel,
            error: e.message,
            agentId,
          },
        );
      }
    }
  } catch (e: any) {
    ctx.logger.error("Error handling agent.run.failed event", {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
