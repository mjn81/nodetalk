# NodeTalk Future Roadmap & TODO

This document tracks planned features, performance optimizations, and upcoming architectural changes for NodeTalk.

---

## 🚀 Phase 6: Performance & Core Stability
*High priority. Focusing on user experience and system reliability.*

- **UI Performance Optimization**: Resolve the "remounting" issue and reduce React rendering times to ensure a buttery-smooth interface.
- **Complete Internationalization (i18n)**: Finalize all translations and ensure 100% coverage for English, Persian, and Arabic.
- **Avatar System Refinement**: Resolve edge cases in deterministic avatar generation and icon rendering.
- **Network Status Indicator**: Implement a real-time connection quality indicator (WiFi-style signal bar) for both WebSocket and UDP sessions.
- **Improved Drag-and-Drop**: 
    - Remove background blur for cleaner UX.
    - Implement a custom, high-fidelity SVG icon set for file types.
- **Predictable Channel Logic**: Ensure consistent channel ID generation and state synchronization across multiple clients.

## 🔒 Phase 7: Security & Privacy (Security Tab)
*Enhancing user control and privacy features.*

- **Security Settings Tab**: Implement a dedicated tab in the Settings Modal for:
    - **DM Privacy**: Option to Allow/Disallow direct messages from server members.
    - **Group Privacy**: Option to Allow/Disallow being added to groups automatically.
    - **Whisper Permissions**: Granular controls for the upcoming Whisper mode.
- **Whisper Mode (E2EE Unsaved Chats)**: 
    - Implement temporary, non-persisted chat rooms using ephemeral keys.
    - Messages exist only in RAM and are wiped on session end.
- **Secure Link Previews**: 
    - Add external link previews with a server-side caching proxy to prevent leaking user IP addresses to external sites.

## 🎙️ Phase 8: Advanced Voice & Media
*Upgrading the audio/video experience.*

- **Voice Signal Processing**:
    - Integrate Echo Cancellation, Noise Suppression, and Automatic Gain Control (AGC) controls into the app settings (currently OS-managed).
- **Voice Optimization**:
    - **UDP Compression**: Implement Opus compression for raw UDP streams to reduce bandwidth usage.
    - **Voice Activity Detection (VAD)**: Intelligent silence suppression to save bandwidth and improve clarity.
- **Custom Video Player**: Implementation of a native, secure video player for in-app media playback.

## 📱 Phase 9: Platform Expansion
*Bringing NodeTalk to more devices.*

- **PWA Support**: Enable Progressive Web App features for desktop-like experience on mobile browsers.
- **Native Mobile Clients**: Specialized applications for **Android** and **iOS** using the same server-trusted encryption core.

## 🔌 Phase 10: Ecosystem & Integration
*Long-term extensibility and infrastructure.*

- **Plugin Architecture**: Implement a robust system for community-driven features.
- **Core Plugins**:
    - **Basic Stickers**: Support for custom sticker packs.
- **Storage Scalability**: Add **S3-compatible** storage support for hosting large files on AWS, MinIO, or DigitalOcean.
- **Telemetry & Versioning**:
    - **Automated Update Checks**: Backend check for new versions against main NodeTalk servers.
    - **Telemetry (V1.1)**: Optional, privacy-conscious backend metrics to improve performance.

## 🌐 Phase 11: Inter-Node Federation
*Will implement later. Bridging isolated servers into a global network.*

- **Server-to-Server Protocol**: Implementation of a secure handshake and routing protocol allowing independent NodeTalk instances to discover and trust each other.
- **Cross-Server Messaging**: Enable users on `server-a.com` to join channels and message users on `server-b.com` seamlessly.
- **Global Identity Routing**: Resolve user presence and message delivery across the federated network while maintaining local data ownership.
