export type EventKey =
  | "issue.created"
  | "issue.comment.created"
  | "issue.statusChanged"
  | "issue.checked_out"
  | "issue.released"
  | "approval.created"
  | "approval.decided"
  | "agent.run.finished"
  | "agent.run.cancelled"
  | "agent.run.failed"
  | "budget.incident.opened"
  | "budget.incident.resolved";

export interface EventConfig {
  enabled: boolean;
  channels: string[];
}

export interface EventsConfig {
  "issue.created": EventConfig;
  "issue.comment.created": EventConfig;
  "issue.statusChanged": EventConfig;
  "issue.checked_out": EventConfig;
  "issue.released": EventConfig;
  "approval.created": EventConfig;
  "approval.decided": EventConfig;
  "agent.run.finished": EventConfig;
  "agent.run.cancelled": EventConfig;
  "agent.run.failed": EventConfig;
  "budget.incident.opened": EventConfig;
  "budget.incident.resolved": EventConfig;
}

export interface PluginConfig {
  slackBotToken: string;
  paperclipUrl: string;
  events: EventsConfig;
}
