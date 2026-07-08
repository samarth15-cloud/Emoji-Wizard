# 🤖 Discord Emoji ZIP Uploader Bot

A **production-grade** Discord.js v14 bot that uploads emoji batches from ZIP archives to Discord servers. Features Components V2 UI, a professional upload queue, exponential backoff retry logic, live progress tracking, and a fully interactive settings panel.

---

## Features

| Feature | Description |
|---|---|
| **Components V2 UI** | Premium dashboard using ContainerBuilder, SectionBuilder, TextDisplayBuilder |
| **ZIP extraction** | Streaming extraction — never loads entire archive into RAM |
| **Emoji normalisation** | Auto-converts filenames to valid Discord emoji names |
| **Upload queue** | Configurable concurrency (1–10) with p-limit |
| **Retry engine** | Exponential backoff with Discord Retry-After respect |
| **Live progress** | Continuously-edited progress panel (no spam) |
| **Duplicate handling** | Skip / auto-rename / overwrite |
| **Dry run mode** | Simulate uploads without calling the Discord API |
| **Settings panel** | Interactive dropdowns and modal for all options |
| **ZIP validation** | Zip-slip prevention, size checks, format validation |
| **Log rotation** | Winston + daily-rotate-file (JSON + pretty console) |
| **Session management** | TTL-based GC, max 3 concurrent sessions per guild |

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd discord-bot
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in DISCORD_TOKEN + DISCORD_CLIENT_ID
```

### 3. Create your bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → give it a name
3. **Bot** → **Reset Token** → copy the token into `DISCORD_TOKEN`
4. Copy the **Application ID** into `DISCORD_CLIENT_ID`
5. Enable **Message Content Intent** *(not strictly required but improves file collection)*
6. Under **OAuth2 → URL Generator**: select scopes `bot` + `applications.commands`,
   bot permissions `Manage Expressions` + `Read Messages/View Channels` + `Send Messages`
7. Open the generated URL and add the bot to your server

### 4. Deploy slash commands

```bash
# Development: instant guild-scoped (set DISCORD_GUILD_ID in .env)
pnpm --filter @workspace/discord-bot run deploy

# Production: global registration (up to 1h propagation)
pnpm --filter @workspace/discord-bot run deploy:global
```

### 5. Start the bot

```bash
# Development (hot reload)
pnpm --filter @workspace/discord-bot run dev

# Production
pnpm --filter @workspace/discord-bot run start
```

---

## Usage

### `/emoji-upload`

Open the interactive dashboard:

```
/emoji-upload
```

Upload a ZIP immediately:

```
/emoji-upload zip:<file.zip>
```

Dry run (no real uploads):

```
/emoji-upload dry_run:True
```

### Dashboard Buttons

| Button | Action |
|---|---|
| 📤 Upload ZIP | Waits for you to send a ZIP in the channel |
| ⚙️ Settings | Opens the settings panel with dropdowns |
| 🔧 Advanced | Opens the settings modal for concurrency / retries |
| ❓ Help | Full documentation panel |
| 🔄 Refresh | Reloads dashboard with current server stats |
| 🚫 Cancel | Cancels the active upload session |

---

## Configuration

All configuration is via environment variables (validated with Zod):

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | — | **Required** Bot token |
| `DISCORD_CLIENT_ID` | — | **Required** Application ID |
| `DISCORD_GUILD_ID` | — | Optional; required for guild-scoped command deploy |
| `MAX_ZIP_SIZE_MB` | `100` | Maximum ZIP file size |
| `TEMP_DIR` | `./tmp` | Temporary extraction directory |
| `LOG_LEVEL` | `info` | winston log level |
| `LOG_DIR` | `./logs` | Log file directory |
| `DEFAULT_CONCURRENCY` | `2` | Parallel upload count |
| `DEFAULT_MAX_RETRIES` | `3` | Max retries per emoji |
| `PROGRESS_INTERVAL_MS` | `2000` | Live panel refresh interval |

---

## Architecture

```
src/
├── index.ts              Entry point (startup sequence)
├── bot.ts                Discord client factory + event registration
│
├── commands/
│   ├── index.ts          Command registry (Map for O(1) dispatch)
│   └── emoji-upload.ts   /emoji-upload slash command
│
├── events/
│   ├── ready.ts          Gateway ready — logs startup banner
│   ├── interactionCreate.ts  Routes interactions to handlers
│   └── error.ts          Client errors + process signal handlers
│
├── handlers/
│   ├── button.ts         All button custom ID → action mappings
│   ├── modal.ts          Settings modal submission
│   └── select.ts         StringSelectMenu → settings updates
│
├── builders/             Components V2 panel constructors
│   ├── dashboard.ts      Main dashboard (server stats, slots, buttons)
│   ├── progress.ts       Live upload progress panel
│   ├── settings.ts       Settings configuration panel
│   ├── help.ts           Documentation panel
│   ├── completion.ts     Upload summary / completion panel
│   └── error-panel.ts    Error display with recovery hints
│
├── components/           Reusable Discord component builders
│   ├── buttons.ts        All ButtonBuilder factory functions
│   ├── modals.ts         ModalBuilder + input parsers
│   └── selects.ts        StringSelectMenuBuilder factories
│
├── upload/
│   ├── engine.ts         Full pipeline orchestrator (download → extract → queue)
│   └── session.ts        Validation + extraction stages
│
├── zip/
│   ├── validator.ts      ZIP pre-validation (security + format checks)
│   └── extractor.ts      Streaming extraction with zip-slip protection
│
├── emoji/
│   ├── processor.ts      Name normalisation + deduplication
│   ├── validator.ts      Per-file size/dimension validation
│   └── uploader.ts       guild.emojis.create() with p-retry
│
├── queue/
│   └── manager.ts        p-limit queue with per-item state tracking
│
├── storage/
│   └── session-store.ts  In-memory session store with TTL GC
│
├── utils/
│   ├── format.ts         Duration, bytes, progress bar, speed formatters
│   ├── discord.ts        Emoji slots, permission checks, guild helpers
│   └── progress.ts       Progress snapshot computation
│
├── config/
│   ├── schema.ts         Zod environment schema
│   └── index.ts          Config loader singleton
│
├── logging/
│   └── logger.ts         Winston logger with daily rotation
│
├── types/
│   └── index.ts          All TypeScript interfaces + custom errors
│
└── constants/
    └── index.ts          Discord limits, CUSTOM_IDs, colours, icons
```

---

## Security

- **Zip-slip mitigation** — every entry path is resolved and checked against the extraction root before writing
- **Path traversal** — `../` and absolute paths are rejected
- **macOS/Windows metadata** (`__MACOSX`, `.DS_Store`, `Thumbs.db`) filtered silently
- **Hidden files** (`.gitignore`, `.env`) ignored in ZIP contents
- **Maximum ZIP size** enforced before extraction
- **Maximum file count** enforced to prevent DoS
- **Permissions** checked per-user and per-bot before any upload attempt

---

## Developer Guide

### Adding a new command

1. Create `src/commands/my-command.ts` exporting a `SlashCommand`
2. Import and add it to `src/commands/index.ts`
3. Re-run `pnpm deploy`

### Adding a new button

1. Add the custom ID to `CUSTOM_IDS` in `src/constants/index.ts`
2. Add a factory function in `src/components/buttons.ts`
3. Register a handler in `src/handlers/button.ts`

### Adding a new panel

1. Create `src/builders/my-panel.ts` returning `ContainerBuilder`
2. Use `COLORS`, `ICONS`, and the existing component factories
3. Set `flags: MessageFlags.IsComponentsV2` when sending

---

## Required Bot Permissions

| Permission | Why |
|---|---|
| `Manage Expressions` | Create and delete emojis |
| `Read Messages / View Channels` | Receive file attachments from users |
| `Send Messages` | Send progress ephemeral messages |

---

## Troubleshooting

**"Missing permissions" error**
→ Grant `Manage Expressions` in Server Settings → Roles → Bot Role

**Commands not appearing**
→ Re-run `pnpm deploy`; for guild commands, verify `DISCORD_GUILD_ID` is set

**ZIP rejected as too large**
→ Increase `MAX_ZIP_SIZE_MB` in `.env`

**Bot offline / not responding**
→ Check `logs/error-YYYY-MM-DD.log` for startup errors

**Upload stuck**
→ Click **🚫 Cancel** in the dashboard; the session will be cleaned up automatically
