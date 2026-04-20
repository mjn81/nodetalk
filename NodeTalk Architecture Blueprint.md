# **Request for Proposal & Technical Architecture Blueprint**

**Project:** Self-Hosted, Encrypted Chat System ("NodeTalk")  
**Stack:** Go (Backend), BadgerDB (Database), Wails (Desktop Client), React (Web Client)

## **PART 1: REQUEST FOR PROPOSAL (RFP)**

### **1.1 Executive Summary**

The objective is to develop a highly secure, self-hosted communication platform named **NodeTalk**. It features text messaging, rich expression (emojis, asynchronous voice notes), file sharing, and real-time voice chat. The system is designed for operational simplicity (single Go binary) and strict client-side encryption. NodeTalk supports Matrix-style inter-node federation, robust global localization (LTR/RTL), and defaults to local-only operation for air-gapped security.

### **1.2 Core Objectives**

* **Operational Simplicity:** Single Go backend \+ embedded BadgerDB. No external database setups (like PostgreSQL or Redis) required.  
* **Privacy by Design:** Server is a "dumb router"; all payloads (text, voice notes, files) are encrypted client-side.  
* **Federation & Air-Gap Friendly:** Defaults to local node; supports :domain for inter-node communication.  
* **Global Inclusivity & Expression:** Full i18n (Internationalization) support with dynamic RTL/LTR text handling, native emojis, and voice messaging.

### **1.3 Scope of Work & Deliverables**

* **Go Backend:** HTTP API, WSS router (using nhooyr.io/websocket), Inter-node federation router, Raw UDP Voice Router, and BadgerDB data access layer.  
* **Clients (Web & Desktop):** \* **React Web Client:** Full text, voice notes, emojis, presence, files, and multi-language support.  
  * **Wails Desktop Client:** Includes Go bindings for Zstd compression and **Raw UDP Voice**.

## **PART 2: TECHNICAL ARCHITECTURE & DESIGN DOCUMENT**

### **2.1 System Architecture Overview**

The architecture uses a hub-and-spoke model where the Go Server acts as the central hub for ciphertext and binary blobs. The system is built around standard, reliable packages to avoid reinventing the wheel.  
**Recommended Core Packages:**

* **Backend (Go):** dgraph-io/badger (DB), nhooyr.io/websocket (Websockets), golang.org/x/time/rate (Rate Limiting), golang.org/x/crypto/argon2 (Hashing).  
* **Frontend (React):** react-i18next (Localization), @emoji-mart/react (Emoji Picker), react-audio-voice-recorder (Voice notes), minidenticons (SVG Avatars).

### **2.2 Configuration & Security Pipeline**

1. **Server Initialization:** \* Reads config.toml for domain and ports.  
   * **Master Password:** Read from config.toml or Env. **IF NOT SETUP:** The server must generate a random 32-character secure string, print it clearly to the terminal, and use it as the Master Password.  
   * Hashed via **Argon2id** to derive a Key Encryption Key (KEK), which unlocks the database Data Encryption Key (DEK).  
2. **User Authentication:** \* Simple Username/Password authentication. Passwords stored using **Argon2id** (server-side).  
3. **Channel Key Distribution:** \* Server generates a unique **AES-256-GCM** key per channel. Clients fetch these into RAM over WSS.  
4. **Rate Limiting:** \* Using golang.org/x/time/rate: Limits total requests per IP to prevent DDoS. Strict limits on /api/login and /api/register to prevent brute force.

### **2.3 Omnichannel Structure (Unified Logic)**

NodeTalk simplifies conversations by treating **all chats as Channels**. There is no database-level distinction between a "1-on-1" and a "Group".

* **The Logic:** A Channel simply has an array of members.  
* **UI Rendering (Client-Side Smart Display):**  
  * **If members.length \=== 2:** The React UI dynamically sets the channel name to the *other* user's username and uses their Identicon as the avatar.  
  * **If members.length \> 2:** The UI displays the custom channel name (e.g., "Project Team") and a group icon.  
* **Evolution:** If Alice and Bob are in a channel, and Alice invites Charlie, Bob's UI instantly detects members.length \=== 3 and updates the display to a group chat organically. No migration or "group creation" required.

### **2.4 Rich Messaging & Localization Pipeline**

* **Voice Notes:** Users can hold to record voice messages (using browser MediaRecorder API / react-audio-voice-recorder). The audio blob is encrypted client-side, uploaded like a standard file, and dispatched with type: "voice".  
* **Emojis:** Native Unicode emojis injected via @emoji-mart/react. Stored as standard UTF-8 in the ciphertext payload.  
* **Localization (RTL & LTR):** \* App framework uses react-i18next for UI translations.  
  * **Dynamic Text Direction:** Message bubbles implement standard HTML \<div dir="auto"\>. This allows English (LTR) and Arabic/Hebrew (RTL) to coexist perfectly in the same chat.  
  * **CSS Logical Properties:** The UI utilizes standard CSS (e.g., margin-inline-start instead of margin-left) so the entire layout automatically flips gracefully when the user's base language changes to RTL.

### **2.5 Air-Gapped Assets (Avatars)**

* **No External APIs:** The app must not call Gravatar or external CDNs.  
* **Deterministic Avatars:** Use a lightweight SVG generator package like minidenticons on the frontend. Generating it client-side saves DB space and server processing.  
* **Colors:** Seeded by the username string, ensuring "Alice" always has the same exact SVG and color pattern on every device natively.

### **2.6 Database Schema (BadgerDB Key-Value)**

*Rule of Thumb: Keep it flat, use secondary index keys for quick lookups to avoid scanning.*  
| **Category** | **Key Pattern** | **Value (JSON) / Description** |  
| **Users** | u:{user\_id} | { username, pwd\_hash, domain, status, custom\_msg, created\_at, pub\_key } |  
| **Channels** | c:{channel\_id} | { name, creator\_id, members: \["u1", "u2"\], aes\_key\_encrypted, created\_at } |  
| **User-Channels** | uc:{user\_id}:{channel\_id} | { joined\_at } *(Smart Index: Allows the server to query all channels for a specific user instantly without scanning the whole 'Channels' table)* |  
| **Messages** | m:{chan\_id}:{time\_nano} | { id, sender\_id, type ("text"|"file"|"voice"), ciphertext, nonce, sig } |  
| **Presence** | p:{user\_id} | { last\_seen, current\_status } *(Ephemeral, auto-updated by WSS)* |  
| **Files/Media** | f:{file\_uuid} | { owner\_id, size, mime (e.g., "audio/webm", "image/png"), storage\_path, thumb\_ciphertext } |

## **PART 3: AI CODING INSTRUCTIONS**

### **Phase 1: Core Backend & Auth**

* Implement config.toml and Master Password generation/Argon2id KEK logic.  
* Set up standard BadgerDB connection and User registration/login.  
* Implement Rate Limiting middleware using golang.org/x/time/rate for HTTP and WebSocket upgrades.

### **Phase 2: The Unified Channel & Websocket Router**

* Implement nhooyr.io/websocket for the main duplex connection.  
* Create the Channel CRUD logic using the simplified unified model (just add users to the members array).  
* Implement the uc:{user\_id}:{channel\_id} junction index for fast channel lookups on app load.

### **Phase 3: React UI, Localization & Avatars**

* Build the React UI utilizing CSS logical properties for seamless RTL/LTR flipping.  
* Integrate react-i18next for UI language mapping and \<div dir="auto"\> for message bodies.  
* Implement minidenticons (or similar) to automatically generate offline-first SVG avatars based on user\_id.

### **Phase 4: Rich Messaging (Voice & Emoji)**

* Integrate @emoji-mart/react for the chat input.  
* Integrate Web Audio API / react-audio-voice-recorder to allow users to record, encrypt, and send audio blobs natively.

### **Phase 5: Wails & UDP Voice (Desktop Add-ons)**

* Wrap the React app in Wails.  
* Implement the raw UDP listener/router in Go.  
* Expose Go-bindings to the Wails frontend for native OS microphone/speaker routing to bypass browser WebRTC limitations.