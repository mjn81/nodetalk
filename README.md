# NodeTalk

**Self-hosted, end-to-end encrypted communication platform.**

> Single binary. Zero external dependencies. Air-gap ready.

---

## Features

| Feature | Status |
|---|---|
| Text messaging (AES-256-GCM E2EE) | ✅ Phase 1 & 2 |
| Real-time WebSocket delivery | ✅ Phase 2 |
| Voice notes (browser MediaRecorder) | ✅ Phase 4 |
| Emoji picker (`@emoji-mart`) | ✅ Phase 4 |
| Offline-first deterministic avatars | ✅ Phase 3 |
| Full i18n — EN / FA / AR (RTL/LTR) | ✅ Phase 3 |
| File upload & download | ✅ Phase 4 |
| Presence indicators | ✅ Phase 2 |
| Rate limiting (global + auth) | ✅ Phase 1 |
| inter-node Federation | 🔜 Phase 2 stub |
| Wails desktop + raw UDP voice | 🔜 Phase 5 |

---

## Architecture

```
nodetalk/
├── cmd/server/        → Go server entry point
├── internal/
│   ├── config/        → TOML config + master password bootstrap
│   ├── crypto/        → Argon2id hashing, AES-256-GCM, KEK/DEK management
│   ├── db/            → BadgerDB wrapper + domain queries
│   ├── store/         → Repository layer (Users, Channels, Messages, Files)
│   ├── auth/          → Session store, Bearer token middleware
│   ├── api/           → HTTP REST handlers & router
│   ├── ws/            → WebSocket Hub (nhooyr.io/websocket)
│   ├── middleware/     → Rate limiting, CORS, JSON helpers
│   ├── models/        → Domain structs (User, Channel, Message, …)
│   └── federation/    → Inter-node routing stub (Phase 2)
├── frontend/
│   └── src/
│       ├── api/        → TypeScript API client
│       ├── ws.ts       → WebSocket client + Web Crypto AES-GCM
│       ├── context/    → AuthContext, ChannelContext
│       ├── components/ → Avatar, ChatArea, Sidebar, EmojiPicker, VoiceRecorder, …
│       ├── pages/      → LoginPage, RegisterPage, AppPage
│       └── i18n/       → EN / FA / AR translations
├── config.toml.example
└── Makefile
```

### Security Pipeline

```
Master Password (config.toml or env)
        │
        ▼ Argon2id
   Key Encryption Key (KEK) — stays in RAM
        │
        ▼ AES-256-GCM wrap/unwrap
  Data Encryption Key (DEK) — stored encrypted in meta DB
        │
        ▼ BadgerDB EncryptionKey
   All data at-rest encrypted

Per-channel AES-256-GCM keys generated on channel creation,
encrypted with KEK, distributed to clients over WSS only.
Clients encrypt messages client-side before sending.
Server routes opaque ciphertext only — never reads message content.
```

---

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+ (for the web frontend)

### 1 — Clone & Configure

```bash
git clone https://github.com/your-org/nodetalk
cd nodetalk
cp config.toml.example config.toml
# Edit config.toml — or leave master_password blank to auto-generate
```

### 2 — Run the Backend

```bash
make run
# Or directly:
go run ./cmd/server
```

On **first launch**, if `master_password` is empty, the server prints a randomly generated 32-character password and saves it to `config.toml`. **Back it up — the database is permanently unrecoverable without it.**

### 3 — Run the Frontend (Development)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 4 — Full Dev Environment (Concurrent)

```bash
make dev
```

### 5 — Production Build

```bash
# Build the Go binary
make build               # → ./nodetalk

# Build the frontend bundle
make frontend/build      # → frontend/dist/
```

---

## Configuration Reference

See [`config.toml.example`](./config.toml.example) for all options.

| Key | Default | Description |
|---|---|---|
| `server.domain` | `localhost` | Public domain name (used for federation) |
| `server.http_port` | `8080` | HTTP API + WebSocket port |
| `server.udp_port` | `9090` | Raw UDP voice port (Wails desktop only) |
| `security.master_password` | *(auto-generated)* | Argon2id KEK source |
| `database.path` | `./data/db` | BadgerDB data directory |
| `rate_limit.global_rps` | `100` | Max requests/sec per IP |
| `rate_limit.auth_rps` | `5` | Max login/register attempts/sec per IP |

**Environment variables** override config file values:

- `NODETALK_CONFIG` — Path to config.toml
- `NODETALK_MASTER_PASSWORD` — Master password (12-Factor pattern)

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | — | Create account |
| `POST` | `/api/login` | — | Get session token |
| `POST` | `/api/logout` | Bearer | Invalidate token |
| `GET` | `/api/me` | Bearer | Current user info |
| `POST` | `/api/channels` | Bearer | Create channel/DM |
| `GET` | `/api/channels` | Bearer | List user's channels |
| `GET` | `/api/channels/{id}` | Bearer | Get channel |
| `POST` | `/api/channels/{id}/members` | Bearer | Add member |
| `GET` | `/api/channels/{id}/messages?limit=50` | Bearer | Message history |
| `POST` | `/api/upload` | Bearer | Upload file/voice note |
| `GET` | `/api/files/{id}` | Bearer | Download file |
| `GET` | `/api/users/{id}/presence` | Bearer | User presence |
| `GET` (WS) | `/ws?token=<token>` | Query token | WebSocket connection |

---

## WebSocket Protocol

Messages are JSON envelopes: `{ "type": string, "payload": object }`.

| Type (server→client) | Description |
|---|---|
| `channel_key` | AES-256 key for a channel `{ channel_id, aes_key }` |
| `message` | Encrypted chat message |
| `presence` | User status change `{ user_id, status }` |

| Type (client→server) | Description |
|---|---|
| `message` | Send encrypted message `{ channel_id, type, ciphertext, nonce }` |
| `ping` | Heartbeat (keep-alive + presence update) |

---

## Testing

```bash
# Run all Go tests
make test

# Run specific package tests
go test ./internal/crypto/... -v -race
go test ./internal/auth/... -v -race
go test ./internal/config/... -v -race
```

---

## Localization

NodeTalk ships with EN, FA (Persian), and AR (Arabic) out of the box. Language is:
1. Persisted to `localStorage` (`nodetalk_lang`)
2. Auto-detected from browser `navigator.language`
3. Falls back to English

RTL mode (`dir="rtl"`) is applied automatically to `<html>` when a right-to-left language is active. All CSS uses logical properties (`margin-inline-start`, `padding-block-end`) so the layout flips without any additional overrides.

---

## Roadmap

| Phase | Milestone | Status |
|---|---|---|
| 0 | Project scaffolding, Go module, Vite+React | ✅ |
| 1 | Config, BadgerDB, Argon2id, Rate Limiting, Auth API | ✅ |
| 2 | WebSocket Hub, Unified Channel Model, Channel Key Distribution, Presence | ✅ |
| 3 | React UI, i18n (EN/FA/AR), CSS logical properties, Identicons | ✅ |
| 4 | Voice Notes, Emoji Picker, File Upload/Download | ✅ |
| 5 | Wails Desktop, Raw UDP Voice Router, Go bindings | 🔜 |
| 6 | Federation: inter-node message delivery | 🔜 |
| 7 | Production hardening: mTLS, audit logs, Docker image | 🔜 |

---

## License

MIT © NodeTalk Contributors
