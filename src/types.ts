export type EventKey =
  | "issue.created"
  | "issue.comment.created"
  | "issue.statusChanged"
  | "approval.created"
  | "approval.decided"
  | "agent.run.failed";

export interface EventConfig {
  enabled: boolean;
  channels: string[];
}

export interface EventsConfig {
  "issue.created": EventConfig;
  "issue.comment.created": EventConfig;
  "issue.statusChanged": EventConfig;
  "approval.created": EventConfig;
  "approval.decided": EventConfig;
  "agent.run.failed": EventConfig;
}

export interface PluginConfig {
  slackBotToken: string;
  paperclipUrl: string;
  events: EventsConfig;
}
