import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import type { Block, KnownBlock } from "@slack/types";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseApproval } from "./payloads.js";
import { resolveActorName } from "./utils.js";

export async function handleApprovalCreated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["approval.created"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  await handleApproval(ctx, event, "created", eventCfg.channels);
}

export async function handleApprovalDecided(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["approval.decided"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  await handleApproval(ctx, event, "decided", eventCfg.channels);
}

async function handleApproval(
  ctx: PluginContext,
  event: PluginEvent,
  kind: "created" | "decided",
  channels: string[],
): Promise<void> {
  const config = getConfig();
  const companyId = event.companyId;

  try {
    const parsed = parseApproval(event, kind);
    if (!parsed.ok) {
      await reportEventProcessingError(ctx, event, channels, parsed.reason, parsed.details);
      return;
    }

    const approval = parsed.value;
    const approver = await resolveActorName(ctx, event, companyId);

    const formatter = new SlackFormatter(config.paperclipUrl);
    let message: { text: string; blocks: (Block | KnownBlock)[] };

    if (kind === "created") {
      message = formatter.approvalCreated({
        id: approval.id,
        issueId: approval.issueId,
        issueTitle: approval.issueTitle ?? approval.issueId,
        approver,
        comment: approval.comment,
      });
    } else {
      message = formatter.approvalDecided({
        id: approval.id,
        issueId: approval.issueId,
        issueTitle: approval.issueTitle ?? approval.issueId,
        approver,
        decision: approval.decision,
        comment: approval.comment,
      });
    }

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(ctx, slack, channels, message, `approval.${kind}`, {
      approvalId: approval.id,
    });
  } catch (e: any) {
    ctx.logger.error(`Error handling approval.${kind} event`, {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
