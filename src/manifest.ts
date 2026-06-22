import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "everlastingcrown.paperclip-slack",
  apiVersion: 1,
  version: "0.0.0",
  displayName: "Slack Notifications",
  description:
    "Sends Paperclip event notifications to configured Slack channels. Supports issue creation, comments, status changes, approvals, and agent errors.",
  author: "everlastingcrown",
  categories: ["automation", "connector"],
  capabilities: [
    "events.subscribe",
    "issues.read",
    "agents.read",
    "http.outbound",
    "plugin.state.read",
    "plugin.state.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    required: ["slackBotToken"],
    properties: {
      slackBotToken: {
        type: "string",
        title: "Slack Bot OAuth Token",
        description:
          "Bot token from api.slack.com (starts with xoxb-). The bot must have chat:write and channels:read scopes. To resolve private channels by name, also grant groups:read and invite the bot to the channel.",
      },
      paperclipUrl: {
        type: "string",
        title: "Paperclip URL",
        description:
          "Base URL of your Paperclip instance. Used to generate links back to issues, agents, and approvals.",
        default: "http://localhost:3100",
      },
      events: {
        type: "object",
        title: "Event Notifications",
        description:
          "Toggle and route each event type to Slack channels. Public channels can be names (#general) or IDs (C0123456). Private channels can be names with groups:read or IDs (G0123456).",
        properties: {
          "issue.created": {
            type: "object",
            title: "Issue Created",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#general"],
              },
            },
          },
          "issue.comment.created": {
            type: "object",
            title: "Issue Comment Created",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#general"],
              },
            },
          },
          "issue.statusChanged": {
            type: "object",
            title: "Issue Status Changed",
            description:
              "Detects status field changes on issue.updated events.",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#general"],
              },
            },
          },
          "approval.created": {
            type: "object",
            title: "Approval Requested",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#general"],
              },
            },
          },
          "approval.decided": {
            type: "object",
            title: "Approval Decided",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#general"],
              },
            },
          },
          "agent.run.failed": {
            type: "object",
            title: "Agent Run Failed",
            properties: {
              enabled: {
                type: "boolean",
                title: "Enabled",
                default: true,
              },
              channels: {
                type: "array",
                title: "Channels",
                items: { type: "string" },
                default: ["#alerts"],
              },
            },
          },
        },
      },
    },
  },
};

export default manifest;
