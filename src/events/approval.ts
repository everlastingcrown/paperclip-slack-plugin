import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
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
  const approvalId = event.entityId;
  const companyId = event.companyId;
  if (!approvalId) return;

  try {
    const payload = event.payload as Record<string, unknown> | undefined;
    const issueId =
      (payload?.issueId as string) ?? ((payload as any)?.issue?.id as string | undefined);

    let issueTitle: string | undefined;
    if (issueId) {
      try {
        const issue = await ctx.issues.get(issueId, companyId);
        if (issue) {
          issueTitle = issue.title;
        } else {
          issueTitle = issueId;
        }
      } catch {
        issueTitle = issueId;
      }
    }

    const approver = await resolveActorName(ctx, event, companyId);
    const decision =
      kind === "decided"
        ? ((payload?.decision as string) ?? (payload?.outcome as string))
        : undefined;
    const comment =
      (payload?.comment as string) ??
      (payload?.reason as string) ??
      (payload?.description as string);

    const formatter = new SlackFormatter(getConfig().paperclipUrl);
    let message: { text: string; blocks: any[] };

    if (kind === "created") {
      message = formatter.approvalCreated({
        id: approvalId,
        issueId,
        issueTitle,
        approver,
        comment,
      });
    } else {
      message = formatter.approvalDecided({
        id: approvalId,
        issueId,
        issueTitle,
        approver,
        decision,
        comment,
      });
    }

    const slack = new SlackClient(getConfig().slackBotToken);

    for (const channel of channels) {
      try {
        const resolved = await slack.resolveChannel(channel);
        if (!resolved) {
          ctx.logger.warn(`Channel not found for approval.${kind}`, {
            channel,
            approvalId,
          });
          continue;
        }
        await slack.postMessage(resolved, message.text, message.blocks);
        ctx.logger.info(`Slack notification sent for approval.${kind}`, {
          channel,
          approvalId,
        });
      } catch (e: any) {
        ctx.logger.error(
          `Failed to send Slack notification for approval.${kind}`,
          {
            channel,
            error: e.message,
            approvalId,
          },
        );
      }
    }
  } catch (e: any) {
    ctx.logger.error(`Error handling approval.${kind} event`, {
      error: e.message,
      eventId: event.eventId,
      approvalId,
    });
  }
}
