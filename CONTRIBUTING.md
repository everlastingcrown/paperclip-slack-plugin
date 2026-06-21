# Contributing

Thanks for your interest in contributing to the Paperclip Slack Plugin.

## Development Setup

**Requirements:** Node.js >= 24, pnpm >= 10

```bash
git clone https://github.com/everlastingcrown/paperclip-slack-plugin
cd paperclip-slack-plugin
pnpm install
```

### Scripts

| Command | Description |
|---|---|
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run dev` | Build in watch mode |
| `pnpm run test` | Run tests once |
| `pnpm run test:watch` | Run tests in watch mode |

### Project Structure

```
src/
├── index.ts              # Package entry - re-exports manifest + worker
├── manifest.ts            # Plugin manifest and config schema
├── worker.ts              # Plugin lifecycle (setup, validation, health)
├── config.ts              # Runtime config cache (module-scoped)
├── types.ts               # Shared TypeScript interfaces
├── slack/
│   ├── client.ts          # Slack Web API wrapper (@slack/web-api)
│   └── formatter.ts       # Slack Block Kit message builders
└── events/
    ├── index.ts           # Registers all event handlers
    ├── utils.ts           # Shared helpers (actor name resolution)
    ├── issue-created.ts   # issue.created handler
    ├── issue-comment.ts   # issue.comment.created handler
    ├── issue-status.ts    # issue.updated → status change detection
    ├── approval.ts        # approval.created + approval.decided
    └── agent-error.ts     # agent.run.failed handler

tests/
├── slack-client.test.ts   # Slack API wrapper tests
└── formatter.test.ts      # Block Kit formatting tests
```

## Adding a New Event

1. Create a new handler under `src/events/` (follow the existing pattern)
2. Add the event key to `types.ts` (`EventKey` union + `EventsConfig`)
3. Add the event config schema in `manifest.ts`
4. Register the handler in `src/events/index.ts`
5. Add a Slack Block Kit method in `src/slack/formatter.ts`
6. Add tests under `tests/`

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are used by `semantic-release` to determine the next version:

- `fix:` — patch release (0.0.x)
- `feat:` — minor release (0.x.0)
- `feat!:` / `BREAKING CHANGE:` — major release (x.0.0)

Examples:
```
feat: add support for goal events
fix: handle slack rate limits gracefully
chore: update dependencies
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Add tests for new functionality
3. Ensure `pnpm run test` passes
4. Ensure `pnpm run build` succeeds
5. Follow the existing code style
6. Submit a PR with a clear description

## Release Process

Releases are automated via GitHub Actions and `semantic-release`. Merging to `main` triggers:

1. Version bump (based on commit messages)
2. NPM publish to `@everlastingcrown/paperclip-slack-plugin`
3. GitHub Release with auto-generated changelog

No manual versioning or tagging is needed.
