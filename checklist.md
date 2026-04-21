# NodeTalk Architecture Checklist

This checklist tracks the progress of the implementation based on the NodeTalk Architecture Blueprint.

## Phase 1: Core Backend & Auth (✅ Implemented)
- [x] Implement `config.toml` structure.
- [x] Master Password generation/Argon2id KEK logic.
- [x] Standard BadgerDB connection abstraction.
- [x] User registration/login handlers.
- [x] Rate Limiting middleware (HTTP & WebSocket upgrades).

## Phase 2: The Unified Channel & Websocket Router (✅ Implemented)
- [x] Implement WebSocket hub using (`nhooyr.io/websocket` or similar).
- [x] Unified Channel CRUD (just append users to members array).
- [x] Implement junction index `uc:{user_id}:{channel_id}` for fast lookups.
- [x] SharedWorker multiplexing to share 1 socket across multiple browser tabs.
- [x] Global unread messages badge and `read_receipt` tracking logic.

## Phase 3: React UI, Localization & Avatars (🟢 Mostly Implemented / Ongoing)
- [x] Build React UI using CSS logical properties and Discord-like layout using Tailwind CSS.
- [x] Implement `minidenticons` for offline-first deterministically generated avatars.
- [ ] Integrate `react-i18next` for UI language mapping (English/Arabic RTL support).
- [ ] Setup complete CSS `<div dir="auto">` support natively for RTL languages in message bodies.

## Phase 4: Rich Messaging (Voice & Emoji) (⏱️ Next Steps)
- [ ] Integrate `@emoji-mart/react` for the chat textarea.
- [ ] Incorporate `react-audio-voice-recorder` (or Native Web Audio APIs) for client-side recording.
- [ ] Implement audio client-side AES-256-GCM encryption & blob upload endpoint wrapping.
- [ ] Render embedded audio waveform players natively inside the chat loop.

## Phase 5: Wails & UDP Voice (Desktop Add-ons) (⏳ Pending)
- [ ] Wrap the finalized React web-app into a Wails desktop context.
- [x] Skeleton port-listener for `startUDPRouter` in Go.
- [ ] Implement UDP packet routing logic based on session token headers.
- [ ] Expose Go-bindings to the Wails frontend to pipe raw Desktop MIC input to the UDP backend bypassing browser WebRTC.
