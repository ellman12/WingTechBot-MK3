# Backend Architecture

WingTechBot MK3's backend is a **functional hexagonal** (ports & adapters) application: a soundboard +
karma/reaction analytics engine for a single Discord guild.

The structure exists for two concrete reasons:

1. **Policy is unit-testable.** Business rules live in pure functions/services that take plain data, so
   they don't need a Discord client, Postgres, ffmpeg, or Gemini to be tested.
2. **The core is reusable.** Anything Discord-free in `core/` can be called from a slash command, a CLI
   script, a unit test — or, later, an HTTP API — without a live bot.

The boundary rules below are **enforced by ESLint** (`eslint.config.js`, `no-restricted-imports`
per layer). If a rule blocks you, the fix is almost always "move the Discord-specific part out of
core" or "introduce a port", not "disable the rule".

## Layers

```
src/
├── core/             Domain. Pure TypeScript. Knows nothing about Discord, Kysely, Gemini, ffmpeg.
│   ├── config/       Zod schema + Config type (env-agnostic; loaded by adapters/config)
│   ├── entities/     Domain types (Message, Reaction, Sound, User, BannedFeature, PlayedSound, …)
│   │                 and canonical constants/enums (KarmaEmoteNames, AvailableFeature, …)
│   ├── errors/       Domain error classes (AudioErrors, LlmErrors, …)
│   ├── ports/        Interfaces the core DEPENDS ON (driven ports). Implemented by adapters.
│   │   ├── repositories/   Persistence ports (MessageRepository, SoundRepository, UnitOfWork, …)
│   │   └── services/       External-capability ports (FileManager, LlmService, VoiceService,
│   │                       AudioProcessingService, YoutubeService, AudioProbe)
│   ├── services/     Use cases / domain services. Factory functions over ports + entities only.
│   └── utils/        Pure helpers (text, time, probability, pcm, streams, tables)
│
├── application/      Driving side. Translates the outside world INTO core calls. May import discord.js
│   │                 and core. May NOT import adapters, infrastructure, kysely, or @db.
│   ├── commands/     Slash-command definitions + handlers (one file per feature, deps objects)
│   └── discord/      Discord-coupled orchestration: event handlers, message/user sync, soundboard
│                     thread, LLM conversation glue, auto-reactions, karma-emote bootstrap, chat helpers,
│                     and DiscordApplication (startup orchestration). Each feature exports `createX(deps)`
│                     and, where it listens to events, `registerXEvents(x, registerEventHandler)`.
│
├── adapters/         Driven side. Implementations of core ports. May import core and the tech
│   │                 wrappers in infrastructure. May NOT import application.
│   ├── repositories/ Kysely implementations + KyselyUnitOfWork + file-backed LlmInstructionRepository
│   ├── discord/      DiscordVoiceService (VoiceService port over @discordjs/voice)
│   ├── audio/        OverlappingAudioPlayer, FfmpegAudioProcessingService, YtdlYoutubeAudioService,
│   │                 FfprobeAudioProbe
│   ├── llm/          GeminiLlmService (LlmService port)
│   ├── filestore/    FileManager (fs implementation)
│   └── config/       ConfigAdapter (env → Config)
│
├── infrastructure/   Framework & process wiring. Owns the Discord client lifecycle, DB connection,
│   │                 ffmpeg/yt-dlp process wrappers, error reporting, env loading.
│   │                 May import core and application (to mount it). May NOT import adapters.
│   ├── discord/      DiscordClientHandle (client creation/destruction), DiscordBot (login, ready,
│   │                 event registration, graceful stop). DiscordBot takes an *application* object
│   │                 (registerEvents/onReady) — it does not know individual services.
│   ├── database/     DatabaseConnection (pg pool + Kysely)
│   ├── ffmpeg/, yt-dlp/   Process wrappers used by adapters/audio
│   ├── services/     ErrorReportingService (Discord webhook)
│   └── config/       EnvLoader
│
└── main.ts           Composition root. The ONLY place that imports adapters + infrastructure +
                      application together and wires them. Everything is constructed with deps objects.
```

Outside `src/`: `database/` (migrations + generated Kysely types, alias `@db`), `scripts/` (CLI entry
points — they are composition roots like `main.ts` and may import anything), `tests/`.

## Dependency rules (enforced)

| From \ To                       | core | application | adapters | infrastructure | `@db` | discord.js | kysely / pg | @google/genai |
| ------------------------------- | :--: | :---------: | :------: | :------------: | :---: | :--------: | :---------: | :-----------: |
| `core`                          |  ✅  |     ❌      |    ❌    |       ❌       |  ❌   |     ❌     |     ❌      |      ❌       |
| `application`                   |  ✅  |     ✅      |    ❌    |       ❌       |  ❌   |     ✅     |     ❌      |      ❌       |
| `adapters`                      |  ✅  |     ❌      |    ✅    |       ✅       |  ✅   |     ✅     |     ✅      |      ✅       |
| `infrastructure`                |  ✅  |     ✅      |    ❌    |       ✅       |  ✅   |     ✅     |     ✅      |      ❌       |
| `main.ts`, `scripts/`, `tests/` |  ✅  |     ✅      |    ✅    |       ✅       |  ✅   |     ✅     |     ✅      |      ✅       |

Also: the bare `@/` alias is not allowed inside `src/` (use the layer aliases so the import tells you
which layer you're crossing into). Tests may use `@/main`.

## Conventions

**Functional style.** Services, repositories, adapters are `createX(deps: XDeps): X` factory functions
returning frozen-shaped objects of closures. Types are `type`, not `interface`, unless declaration
merging is needed. Classes are used only where a runtime base class demands it (`Transform` streams,
`AudioPlayer`, `Error` subclasses).

**Deps objects, always.** No positional dependency lists. `createX({ a, b, c })`, with an exported
`XDeps` type. Keep deps minimal — a command that needs one repository method takes that repository,
not "the bot".

**Ports are named for the capability, not the vendor.** `LlmService`, not `GeminiService`;
`VoiceService`, not `DiscordVoiceService`. The adapter file carries the vendor name.

**Discord-shaped data is fine in core; the Discord SDK is not.** Snowflake ids are strings, emotes have
a `discordId`, LLM turns carry an `authorName`. Core never sees `Message`, `Guild`, `Interaction`,
`VoiceState`, etc. — `application/` maps those to plain data at the boundary.

**Core owns canonical enums.** `AvailableFeature`, `VoiceEventSoundType`, `PlayedSoundSource`,
`KarmaEmoteNames`, `instructionTypes` live in `core/entities` / `core/ports`. The Kysely-generated types
in `@db/types` must stay compatible; adapters assert that with a type-level `Equals<>` check, not by
importing `@db` into core.

**Errors cross ports as domain errors.** Adapters translate vendor errors (`@google/genai` `ApiError`,
Discord API codes) into `core/errors` types so application code never needs vendor imports to branch.

**Startup orchestration is application code.** What the bot does when it comes online (deploy
commands, ensure karma emotes, sync history/users, open the soundboard thread, set status) is
`application/discord/DiscordApplication.ts#onReady`. `infrastructure/discord/DiscordBot.ts` only
manages the client lifecycle and calls it.

## Where does X go? (decision guide)

- Needs `discord.js` types or calls the Discord API → `application/discord` (or an adapter if it
  implements a core port, e.g. voice playback).
- A rule you could unit test with plain strings/numbers → `core/services` or `core/utils`.
- Talks to Postgres / ffmpeg / yt-dlp / Gemini / the filesystem → `adapters/*`, behind a port in
  `core/ports`.
- Creates/configures a framework object (Discord `Client`, pg `Pool`) → `infrastructure`.
- Wires concrete things together → `main.ts` (or a `scripts/*.ts` entry point).

## Testing

- `tests/unit` — core services and adapters. Repositories run against `pg-mem` with the real
  migrations. Core services are tested with hand-rolled port stubs; no Discord client involved.
- `tests/integration/audio` — real ffmpeg / yt-dlp.
- `tests/integration/messagesAndReactions`, `fullApplication` — a live Discord guild with a second
  "tester" bot. These exercise `application/discord` + adapters end-to-end and need `.env.test`.
