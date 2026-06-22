# @everlastingcrown/paperclip-slack-plugin

A [Paperclip](https://paperclip.ing) plugin that sends event notifications to Slack channels using Block Kit messages.

## Features

- **Issue notifications** — creation, comments, and status changes
- **Approval notifications** — requests and decisions
- **Agent error alerts** — failed agent runs
- **Per-event channel routing** — each event type can go to different Slack channels
- **Rich Block Kit messages** — formatted with relevant context and "View in Paperclip" links
- **Config validation** — validates token, Slack auth, and channel existence from the Paperclip settings UI
- **Extensible design** — adding new event types requires only a handler, formatter, and schema entry

## Installation

```bash
paperclipai plugin install @everlastingcrown/paperclip-slack-plugin
```

Or install from a local path:

```bash
paperclipai plugin install ~/path/to/paperclip-slack-plugin
```

## Configuration

### 1. Create a Slack Bot

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app from scratch
3. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `chat:write` — send messages
   - `channels:read` — list public channels for validation and name lookup
   - `groups:read` — optional; list private channels for validation and name lookup
4. Install to your workspace and copy the **Bot OAuth Token** (starts with `xoxb-`)
5. Invite the bot to each channel you want notifications in (`/invite @bot-name`)

### 2. Configure the Plugin

In Paperclip's plugin settings, set:

| Setting | Description |
|---|---|
| **Slack Bot OAuth Token** | Your bot token from Slack (starts with `xoxb-`) |
| **Paperclip URL** | Base URL of your Paperclip instance (default: `http://localhost:3100`) |
| **Event Notifications** | Per-event toggles and channel lists (see below) |

### 3. Route Events to Channels

Each event type has its own configuration:

| Event | Default Channels | Description |
|---|---|---|
| Issue Created | `#general` | When a new issue is created |
| Issue Comment Created | `#general` | When a comment is added to an issue |
| Issue Status Changed | `#general` | When an issue's status field changes |
| Approval Requested | `#general` | When an approval is created |
| Approval Decided | `#general` | When an approval is approved or rejected |
| Agent Run Failed | `#alerts` | When an agent run fails with an error |

### Channel Names, IDs, and Private Channels

Channels can be specified as:

| Channel type | Supported values | Required Slack scopes | Notes |
|---|---|---|---|
| Public channel | `#general`, `general`, or `C0123456` | `channels:read`, `chat:write` | The bot must be invited before it can post. |
| Private channel | `#leadership`, `leadership`, or `G0123456` | `groups:read`, `chat:write` for names; `chat:write` for IDs | The bot must be invited to the private channel. |

If you do not want to grant `groups:read`, configure private channels with their Slack channel ID (`G0123456`) instead of `#channel-name`.

During validation, the plugin checks public channel names first. If a configured channel name is not found publicly, it tries private channel lookup when the token has `groups:read`. Public-only setups do not need `groups:read`.

### Example Config

```json
{
  "slackBotToken": "xoxb-...",
  "paperclipUrl": "https://my-paperclip.example.com",
  "events": {
    "issue.created": {
      "enabled": true,
      "channels": ["#engineering"]
    },
    "issue.comment.created": {
      "enabled": true,
      "channels": ["#engineering", "#discussions"]
    },
    "issue.statusChanged": {
      "enabled": true,
      "channels": ["#product"]
    },
    "approval.created": {
      "enabled": true,
      "channels": ["#reviews"]
    },
    "approval.decided": {
      "enabled": true,
      "channels": ["#reviews"]
    },
    "agent.run.failed": {
      "enabled": true,
      "channels": ["#alerts", "#devops"]
    }
  }
}
```

## Message Format

Notifications use Slack Block Kit for rich, consistent messages:

```
┌─────────────────────────────────┐
│  New issue created               │
│  *Fix login page crash*          │
│                                  │
│  Project:     Web App            │
│  Priority:    High               │
│  Status:      Open               │
│                                  │
│  [View in Paperclip]             │
└─────────────────────────────────┘
```

Each message includes a link back to the relevant issue, agent, or approval in Paperclip.

## Development

**Requirements:** Node.js >= 24, pnpm >= 10

```bash
git clone https://github.com/everlastingcrown/paperclip-slack-plugin
cd paperclip-slack-plugin
pnpm install
pnpm run build
pnpm run test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on project structure, adding new event types, and the release process.

## License

MIT — see [LICENSE](LICENSE)
