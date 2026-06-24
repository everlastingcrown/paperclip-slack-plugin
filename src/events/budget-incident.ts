import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseBudgetIncident } from "./payloads.js";

export async function handleBudgetIncidentOpened(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleBudgetIncident(ctx, event, "budget.incident.opened", "opened");
}

export async function handleBudgetIncidentResolved(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleBudgetIncident(ctx, event, "budget.incident.resolved", "resolved");
}

async function handleBudgetIncident(
  ctx: PluginContext,
  event: PluginEvent,
  eventKey: "budget.incident.opened" | "budget.incident.resolved",
  state: "opened" | "resolved",
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events[eventKey];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  try {
    const parsed = parseBudgetIncident(event);
    if (!parsed.ok) {
      await reportEventProcessingError(
        ctx,
        event,
        eventCfg.channels,
        parsed.reason,
        parsed.details,
      );
      return;
    }

    const incident = parsed.value;
    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.budgetIncident({
      ...incident,
      state,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(ctx, slack, eventCfg.channels, message, eventKey, {
      incidentId: incident.id,
    });
  } catch (e: any) {
    ctx.logger.error(`Error handling ${eventKey} event`, {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
