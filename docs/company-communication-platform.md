# Company-Wide Communication Platform
## Replacing WhatsApp with a Programmatic, Self-Hosted Chat System

> **A complete guide for management, HR, and the in-house architect — no technical background required to understand the "why", and all the technical depth needed to build it.**

---

## Table of Contents

1. [The Problem — Why WhatsApp Cannot Scale](#1-the-problem--why-whatsapp-cannot-scale)
2. [What We Need — Requirements](#2-what-we-need--requirements)
3. [The Options Compared](#3-the-options-compared)
   - [Mattermost](#mattermost)
   - [Zulip](#zulip)
   - [Matrix (Synapse + Element)](#matrix-synapse--element)
   - [Rocket.Chat](#rocketchat)
4. [The Recommendation — Why Mattermost Wins](#4-the-recommendation--why-mattermost-wins)
5. [How It Works — For Non-Technical Readers](#5-how-it-works--for-non-technical-readers)
6. [Architecture Overview](#6-architecture-overview)
7. [Integration with Starium Rafa ERP](#7-integration-with-starium-rafa-erp)
   - [Phase 1: Automated User Onboarding & Offboarding](#71-phase-1-automated-user-onboarding--offboarding)
   - [Phase 2: Department & Role-Based Channels](#72-phase-2-department--role-based-channels)
   - [Phase 3: ERP-Driven Notifications & Alerts](#73-phase-3-erp-driven-notifications--alerts)
   - [Phase 4: Single Sign-On (SSO)](#74-phase-4-single-sign-on-sso)
8. [Detailed Implementation Guide](#8-detailed-implementation-guide)
   - [8.1 Deploying Mattermost](#81-deploying-mattermost)
   - [8.2 The Sync Service (Bridge App)](#82-the-sync-service-bridge-app)
   - [8.3 User Lifecycle Management](#83-user-lifecycle-management)
   - [8.4 Channel Management](#84-channel-management)
   - [8.5 Sending Notifications from the ERP](#85-sending-notifications-from-the-erp)
   - [8.6 Embedding Chat into the ERP](#86-embedding-chat-into-the-erp)
9. [Disaster Recovery & Backup](#9-disaster-recovery--backup)
10. [Security & Compliance](#10-security--compliance)
11. [Cost Breakdown](#11-cost-breakdown)
12. [Migration from WhatsApp](#12-migration-from-whatsapp)
13. [Glossary — Terms Explained for Non-Technical Readers](#13-glossary)
14. [Implementation Plan — Phases, Timeline & Milestones](#14-implementation-plan--phases-timeline--milestones)

---

## 1. The Problem — Why WhatsApp Cannot Scale

WhatsApp is great for quick personal chats. But for a company, it becomes a nightmare for these reasons:

| Problem | Impact |
|---|---|
| **Onboarding new staff** | Someone must manually add each new person to every relevant WhatsApp group. There is no API to do this. If HR forgets one group, the new hire misses important messages. |
| **Offboarding terminated staff** | When someone leaves or is fired, you must remember to remove them from every group. If you miss one, they still see company messages. There is no central "deactivate" button. |
| **No central administration** | Any group admin can add or remove people. There is no single source of truth for who has access to what. |
| **No audit trail** | You cannot prove who saw what message, when. If there is a dispute or a compliance issue, WhatsApp gives you nothing. |
| **Mixing personal and work** | Employees use their personal phone numbers. When they leave, your company conversations live on their personal device forever. |
| **No programmatic control** | You cannot write code to automatically create a channel for "Line 3 Night Shift QC Team" and add the right people. You cannot build an integration that sends a quality alert to a specific group when a machine goes out of spec. |

### The Core Requirement

We need a **programmatically controllable** chat system — meaning a system where everything (creating users, creating channels, adding/removing people, sending messages) can be done by code, not by hand. When a new QC Manager is hired in the ERP, the chat system automatically creates their account and adds them to the right channels. When someone is terminated, their access is revoked instantly and completely — with a single action.

---

## 2. What We Need — Requirements

### Must-Have

| Requirement | Why |
|---|---|
| **Self-hosted** | Data stays on our servers. No third party reads our factory communications. |
| **REST API** | Every operation (create user, create channel, add member, send message) must be doable via HTTP requests from our ERP backend code. |
| **Bulk user management** | Create, update, deactivate users programmatically. Import in bulk from CSV or via API. |
| **Programmatic channel membership** | Add users to channels, remove them, reconcile membership (set the exact list of members). |
| **Role-based access** | Different permissions for different users (admin, manager, staff). |
| **Mobile apps** | iOS and Android apps for floor workers who do not sit at desks. |
| **Offline-capable** | Messages queue and send when connectivity is restored (factory floors can have dead zones). |
| **File/image sharing** | Share photos of machine readings, quality issues, etc. |
| **Search** | Search message history to find past decisions and instructions. |

### Nice-to-Have

| Requirement | Why |
|---|---|
| **Single Sign-On (SSO)** | Use the same username/password as the ERP. One login for everything. |
| **Video/voice calls** | For remote supervisors to communicate with floor teams. |
| **Bridges to other platforms** | e.g., a bridge to WhatsApp so factory can still receive messages from suppliers who use WhatsApp. |
| **Threaded conversations** | Keep discussions organized by topic. |

---

## 3. The Options Compared

We researched four platforms that dominate the self-hosted team chat space. Here is every option with honest pros and cons.

---

### Mattermost

**What it is:** An open-source, self-hosted Slack alternative. Written in Go (backend) and React (frontend). Uses PostgreSQL. Created by the same people who built the original Slack integration ecosystem.

**Website:** https://mattermost.com

| Aspect | Detail |
|---|---|
| **Language** | Go (backend), React (frontend) |
| **Database** | PostgreSQL |
| **License** | MIT (Team Edition — completely free) |
| **Deployment** | Docker Compose — up and running in under 5 minutes |
| **Minimum RAM** | ~512 MB |
| **Mobile Apps** | ✅ Excellent — native iOS and Android |
| **Desktop Apps** | ✅ Windows, macOS, Linux |
| **API Quality** | ★★★★★ — Best-in-class REST API, well-documented, extensive |

#### ✅ Pros

1. **Best API in the market.** The Mattermost REST API is comprehensive and mature. You can do everything via API: create users, create teams, create channels, manage memberships, post messages. The new `PUT /api/v4/channels/{channel_id}/members` endpoint (released 2026) lets you pass a complete list of desired user IDs for a channel — Mattermost automatically adds missing users and removes extras. This is **exactly** what you need for reconciling ERP roles with chat channel membership.

2. **Easiest to deploy.** One Docker Compose file. Configure with environment variables. First-run wizard. No config files to hand-edit. Updates are automatic via Docker pull.

3. **Familiar user experience.** It looks and feels like Slack. Employees migrating from WhatsApp will understand it immediately — channels on the left, messages in the center, emoji reactions, threads, file uploads.

4. **Low resource usage.** Written in Go, it is fast and memory-efficient. A factory with 200 users will run comfortably on a $10/month VPS.

5. **Excellent mobile apps.** Floor workers can receive and respond to messages on their phones. Push notifications work even when the app is closed.

6. **Built-in playbooks and boards.** Incident response runbooks, standard operating procedures, and kanban boards — all built in without extra cost.

7. **Slack import.** If you ever decide to migrate FROM Slack (not our case, but good to know), Mattermost has the best import tool.

8. **Large community and ecosystem.** Hundreds of integrations in the Marketplace. Plugins for Jira, GitLab, Grafana, Jenkins — and a plugin framework to build your own.

9. **Active development.** A new compiled version is released every month. The project is backed by a company (Mattermost Inc.) with enterprise customers, so it is not going away.

10. **Bulk data loading.** Import users, teams, channels, and posts from a JSONL file. Perfect for initial setup.

#### ❌ Cons

1. **No end-to-end encryption.** Messages are encrypted in transit (TLS) and at rest (database encryption), but server admins can read messages. For a factory, this is usually acceptable — the factory owns the server. If E2EE were needed, you would pick Matrix.

2. **No federation.** Your Mattermost server is an island. You cannot chat with users on other Mattermost servers. For a single company, this is a feature, not a bug.

3. **Some features require paid license.** LDAP/AD authentication, SAML/SSO, compliance exports, guest accounts, custom roles — these are Enterprise-only. However, for a factory with ~200 users, the Team Edition (free) covers everything you need. You only need the paid plan if you want SAML/SSO without building it yourself.

4. **Video calls require Jitsi.** Mattermost does not have built-in video calling. You need to deploy a separate Jitsi Meet server (which is also free and self-hosted).

---

### Zulip

**What it is:** An open-source team chat platform with a unique topic-based threading model. Created at Dropbox and later open-sourced. Written in Python and JavaScript, uses PostgreSQL.

**Website:** https://zulip.com

| Aspect | Detail |
|---|---|
| **Language** | Python (backend), JavaScript/TypeScript (frontend) |
| **Database** | PostgreSQL |
| **License** | 100% Apache 2.0 — no open-core catch |
| **Deployment** | Ubuntu/Debian script or Docker |
| **Minimum RAM** | ~2 GB |
| **Mobile Apps** | ✅ Good — React Native |
| **API Quality** | ★★★★★ — Excellent, with Python SDK |

#### ✅ Pros

1. **Topic-based threading is revolutionary for async communication.** Every message has a topic. When you arrive after a day off, you see "Line 3: Quality Issue Resolved" as a topic, not 200 unread messages. You can skim topics and read only what matters. This is Zulip's killer feature.

2. **100% open source.** No enterprise gate. Everything is free — SAML, LDAP, advanced permissions, custom profile fields, data exports. Unlike Mattermost, you do not need to pay for SSO.

3. **Excellent API and Python SDK.** The API is very well documented. The Python SDK (`python-zulip-api`) makes it easy to write scripts and integrations.

4. **User groups work well.** You can create groups (e.g., "qc-team", "line-3-night-shift") and manage group membership via API. Groups can be used for @-mentions.

5. **Active and welcoming community.** Over 100,000 words of developer documentation. One of the most active open-source chat communities.

6. **Built for large organizations.** Used by communities with thousands of users. The topic model scales better to large groups than linear chat.

7. **Guest accounts with configurable access.** Useful if you need to give limited access to contractors or external auditors.

#### ❌ Cons

1. **Topic model requires a mental shift.** Employees coming from WhatsApp need to learn to use topics. Some will find it confusing at first. There is a learning curve.

2. **Smaller ecosystem of native integrations.** Fewer pre-built integrations than Mattermost or Rocket.Chat.

3. **No native video/voice.** You need Jitsi (separate deployment) for calls.

4. **Higher resource requirements than Mattermost.** Python backend uses more memory.

5. **Mobile app is less polished.** Functional but not as smooth as Mattermost's mobile apps.

6. **Smaller deployment targets.** Typical deployments are 10-1,000 users (though it can scale higher).

---

### Matrix (Synapse + Element)

**What it is:** Not a single product but a **decentralized protocol** for real-time communication. Think of it like email — anyone can run their own server and communicate with anyone else's server. The reference server is Synapse (Python), and the most popular client is Element.

**Website:** https://matrix.org

| Aspect | Detail |
|---|---|
| **Language** | Python (Synapse), Go (Dendrite — alternative) |
| **Database** | PostgreSQL |
| **License** | Apache 2.0 (protocol), AGPLv3 (Synapse) |
| **Deployment** | Docker Compose or Ansible |
| **Minimum RAM** | ~2-4 GB (Synapse is heavy) |
| **Mobile Apps** | ✅ Excellent — Element is polished |
| **API Quality** | ★★★★☆ — Good, but the spec is complex |

#### ✅ Pros

1. **True end-to-end encryption.** Even the server admin cannot read private messages. Olm/Megolm protocol is state-of-the-art.

2. **Federation.** Your factory can communicate with suppliers, partners, or headquarters on different Matrix servers — no one needs to join your server. Like email for chat.

3. **Bridges to everything.** Matrix has bridges to Slack, Discord, Telegram, WhatsApp, Signal, IRC. You can consolidate all communication into one client.

4. **Open standard.** Not owned by any company. The protocol is governed by the Matrix.org Foundation.

5. **matrix-corporal.** A tool that acts like "Kubernetes for Matrix" — you define a JSON policy describing desired users, rooms, and memberships, and it continuously reconciles the server to match. This is powerful for automated user management.

6. **Multiple homeserver implementations.** Synapse (Python), Dendrite (Go — lighter), Conduit (Rust — experimental). Pick your poison.

7. **Voice/video calls** via Element Call (new MatrixRTC-based) or Jitsi.

#### ❌ Cons

1. **Complexity.** Matrix is significantly harder to deploy and maintain than Mattermost or Zulip. Synapse in particular is resource-heavy and configuration is involved.

2. **Server resource usage.** Synapse with 200 users on an active server requires 4-8 GB RAM minimum. You need a beefy server.

3. **Overkill for a single company.** If you do not need federation (chatting with other companies' servers), you get all of Matrix's complexity with none of the benefit. The advice from experienced self-hosters is unanimous: "If you are not going to federate, do not use Matrix."

4. **matrix-corporal adds another layer of complexity.** While powerful, it is another service to deploy, configure, and maintain.

5. **Admin API for force-joining users to rooms** is less mature than Mattermost's equivalent. The feature was only added in 2020 (via PR #7051), and it still requires accepting invitations on the user side in some cases.

6. **SCIM provisioning proposal was rejected.** MSC4098, which would have added standard SCIM provisioning, was closed. So enterprise provisioning remains less standardized.

---

### Rocket.Chat

**What it is:** An open-source team chat platform written in Node.js (Meteor framework) with MongoDB. Known for being a "kitchen sink" — it has every feature imaginable.

**Website:** https://rocket.chat

| Aspect | Detail |
|---|---|
| **Language** | Node.js (Meteor), MongoDB |
| **Database** | MongoDB |
| **License** | MIT |
| **Deployment** | Docker Compose or Snap |
| **Minimum RAM** | ~1 GB |
| **Mobile Apps** | ✅ Good |
| **API Quality** | ★★★★☆ — Good, with REST and GraphQL |

#### ✅ Pros

1. **Feature-rich.** Omnichannel (live chat for customers), video calls (built-in Jitsi), voice rooms, federated via Matrix bridge, LDAP authentication free, guest accounts free, custom roles free, message retention policies free.

2. **More free features than Mattermost.** Most of the features Mattermost charges for (LDAP, guest accounts, custom roles) are free in Rocket.Chat.

3. **Federation via Matrix bridge.** Can communicate with the Matrix ecosystem if needed.

4. **Large marketplace.** Many community plugins and integrations.

5. **Slack-compatible webhooks.** Easy to send messages from existing systems.

#### ❌ Cons

1. **Heavier stack.** Node.js + MongoDB is more resource-intensive than Mattermost's Go + PostgreSQL. MongoDB also requires more maintenance and care.

2. **Less polished user experience.** The UI is functional but not as clean or intuitive as Mattermost's.

3. **Slower performance.** Node.js event loop can struggle under heavy load compared to Go's compiled performance.

4. **MongoDB complexity.** Running MongoDB properly requires expertise — backup/restore is more involved than PostgreSQL.

5. **Smaller community than Mattermost.** Fewer developers contributing, slower release cycle.

---

## 4. The Recommendation — Why Mattermost Wins

After thorough analysis, **Mattermost is the clear choice** for this factory. Here is the reasoning in plain language:

### Reason 1: The API is Built for What We Need

Mattermost's REST API is the most mature and comprehensive of all four options. The newly added **bulk channel membership endpoint** (`PUT /api/v4/channels/{channel_id}/members`) is a game-changer. Here is why:

- **Today:** When a new QC Manager is hired in the ERP, we want them automatically added to: "All Staff Announcements", "QC Team", "Line 2 QC", "Night Shift QC". With the bulk API, the sync service simply says: "These 47 people should be in the QC Team channel." Mattermost handles the rest — adds the new person, removes anyone who should not be there.

- **When someone leaves:** The sync service removes them from ALL channels in a single pass by setting each channel's desired member list to exclude them. One API call per channel. Done.

- **No other platform has this exact bulk-reconciliation API.** It is purpose-built for the "single source of truth" pattern where the ERP is the source of truth and the chat system follows.

### Reason 2: Easiest to Deploy and Maintain

Mattermost deploys in under 5 minutes with Docker Compose:

```bash
# This is literally it:
wget https://raw.githubusercontent.com/mattermost/docker/main/docker-compose.yml
docker compose up -d
```

Updates are `docker compose pull && docker compose up -d`. That is it. No manual config files, no database migrations to worry about, no package dependencies.

For a factory with no dedicated IT team, this simplicity matters enormously. The in-house architect can set it up in an afternoon and spend near-zero time on maintenance.

### Reason 3: The UX Employees Will Actually Use

Mattermost looks and behaves exactly like Slack. Employees coming from WhatsApp will see:

- A list of channels on the left (like WhatsApp groups, but organized)
- A message area in the center
- Emoji reactions, @mentions, file uploads, search

The learning curve is measured in minutes, not days. This matters because adoption is the biggest risk in any communication tool change — if people find it hard to use, they will not use it.

### Reason 4: Low Resource Requirements

- **RAM:** ~512 MB minimum, 2 GB recommended for 200 users
- **CPU:** 1-2 cores
- **Storage:** ~10 GB for messages (text is tiny; files depend on usage)
- **Database:** PostgreSQL (likely already used by the ERP!)

Contrast with Synapse (Matrix) which needs 4-8 GB RAM for the same load. Mattermost runs comfortably on a $10-15/month VPS.

### Reason 5: Strong Integration Story

Mattermost has:
- **Incoming webhooks** (Slack-compatible) — any system can send messages to any channel via a simple HTTP POST
- **Outgoing webhooks** — Mattermost can send messages to external systems
- **Slash commands** — type `/command` in chat and trigger actions in the ERP
- **Bot accounts** — programmatic bot users with their own API tokens
- **Plugin framework** — build custom plugins in Go/React if needed

### Reason 6: The "In-House Architect" Multiplier

The person building the ERP (the in-house architect) already knows:
- **PostgreSQL** — Mattermost uses it too
- **REST APIs** — same pattern as the ERP's own APIs
- **React** — Mattermost's frontend is React (same as the ERP)

This means the architect can:
- Write the sync service quickly (it is just REST API calls)
- Customize Mattermost if needed (React plugins)
- Troubleshoot issues without learning a new stack

### Verdict

| Criterion | Mattermost | Zulip | Matrix | Rocket.Chat |
|---|---|---|---|---|
| **API for bulk membership mgmt** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ |
| **Ease of deployment** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★★☆ |
| **Familiar UX (WhatsApp-to-Chat)** | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★★★☆ |
| **Resource efficiency** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ |
| **Mobile app quality** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★☆ |
| **Self-hosted features (free tier)** | ★★★☆☆ | ★★★★★ | ★★★★★ | ★★★★★ |
| **Integrations ecosystem** | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| **Maintenance burden** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ |
| **Overall for this use case** | **★ BEST** | Good | Overkill | Good |

**Mattermost is the recommended platform.**

---

## 5. How It Works — For Non-Technical Readers

Before we dive into technical implementation, here is how the system will work in plain English.

### What Employees Will See

Every employee gets a **Mattermost account**. They install the Mattermost app on their phone (or use the web browser on a desktop). When they log in, they see channels they belong to:

- **#all-announcements** — Company-wide messages from management
- **#production-line-2** — Their specific production line's chat
- **#qc-team** — Quality control team discussions
- **#night-shift** — Their shift-specific channel
- **#hr-notices** — HR announcements, policy changes

They can also direct-message any other employee, share photos (e.g., a photo of a machine error), and search past messages.

### What HR and Management Will Experience

**Onboarding a new hire:**
1. HR enters the new employee's details in the ERP (Starium Rafa).
2. The ERP automatically creates their Mattermost account and sends them a welcome email with their login details.
3. Based on their role (e.g., QC Manager, Line 3 Night Shift), the system automatically adds them to the correct channels.
4. The new hire opens Mattermost and sees everything waiting for them — no manual group additions needed.

**Offboarding a departing employee:**
1. HR deactivates the employee in the ERP (or marks them as terminated).
2. The ERP automatically deactivates their Mattermost account.
3. They are removed from ALL channels instantly.
4. They can no longer log in, see any messages, or access any company communication.
5. A single click in the ERP — no hunting through WhatsApp groups.

**Creating a new channel:**
1. A manager requests a channel for a new project or team.
2. The architect creates it in the ERP settings, assigns the required members by role.
3. The channel appears automatically for everyone who needs it.

### What the System Does Behind the Scenes

A small piece of software called the **Sync Service** runs continuously. It:

1. Connects to both the ERP database and the Mattermost API.
2. Checks every few minutes: "Has anyone been hired, fired, or changed roles?"
3. If yes, it updates Mattermost to match — creates accounts, adds people to channels, removes people from channels.
4. It also sends automatic notifications from the ERP — quality alerts, shift reminders, production updates — to the appropriate channels.

---

## 6. Architecture Overview

Here is the high-level architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STARIUM RAFA ERP                              │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  User DB    │  │  Role/Perms  │  │  Sync Service          │  │
│  │  (Postgres) │  │  Engine      │  │  (Node.js or Python)   │  │
│  └──────┬──────┘  └──────┬───────┘  │                        │  │
│         │                │           │  ┌──────────────────┐  │  │
│         ▼                ▼           │  │  Mattermost API  │──┼──┼──▶ HTTP
│  ┌─────────────┐  ┌──────────────┐  │  │  Client          │  │  │     │
│  │  Employee   │  │  Department  │  │  └──────────────────┘  │  │     │
│  │  Records    │  │  Hierarchy   │  └────────────────────────┘  │     │
│  └─────────────┘  └──────────────┘                              │     │
└─────────────────────────────────────────────────────────────────┘     │
                                                                         │
                                                                         ▼
                                                    ┌───────────────────────────┐
                                                    │     MATTERMOST SERVER      │
                                                    │                           │
                                                    │  ┌─────────────────────┐  │
                                                    │  │  Mattermost App     │  │
                                                    │  │  (Go + React)       │  │
                                                    │  └──────────┬──────────┘  │
                                                    │             │             │
                                                    │  ┌──────────▼──────────┐  │
                                                    │  │   PostgreSQL DB     │  │
                                                    │  │   (Messages, etc.)  │  │
                                                    │  └─────────────────────┘  │
                                                    │                           │
                                                    │  ┌─────────────────────┐  │
                                                    │  │  Nginx Reverse      │  │
                                                    │  │  Proxy + HTTPS      │  │
                                                    │  └─────────────────────┘  │
                                                    └───────────────────────────┘
                                                                   │
                                    ┌──────────────────────────────┼──────────────────────────────┐
                                    │                              │                              │
                                    ▼                              ▼                              ▼
                           ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
                           │  Mobile App  │              │  Desktop App │              │  Web Browser │
                           │  (iOS/Android)│              │  (Win/Mac/Linux)│            │  (Any device) │
                           └──────────────┘              └──────────────┘              └──────────────┘
```

### Component Breakdown

| Component | What It Does | Technology |
|---|---|---|
| **Mattermost Server** | The chat platform itself. Handles messages, channels, file uploads, push notifications. | Go/React, PostgreSQL |
| **Sync Service** | The bridge between ERP and Mattermost. Reads employee data from ERP, calls Mattermost API to keep users and channels in sync. | Node.js or Python — runs as a background process |
| **Nginx Reverse Proxy** | Handles HTTPS termination, routes traffic to Mattermost. Provides SSL encryption. | Nginx |
| **Push Notification Server** | (Optional) Mattermost's push proxy for mobile notifications when the app is in the background. | Mattermost Push Proxy or custom |

---

## 7. Integration with Starium Rafa ERP

Here is the complete integration plan, broken into phases.

---

### 7.1 Phase 1: Automated User Onboarding & Offboarding

**Goal:** When a user is created, updated, or deactivated in the ERP, the same happens automatically in Mattermost.

#### The Sync Service Logic

The sync service runs a loop every 60 seconds:

```
Every 60 seconds:
  1. Query ERP database for ALL active users (id, email, name, role, active status)
  2. Query Mattermost API for ALL active users
  3. Compute the diff:
     a. Users in ERP but NOT in Mattermost → CREATE in Mattermost
     b. Users in Mattermost but NOT in ERP (deactivated) → DEACTIVATE in Mattermost
     c. Users in both but details changed (name, email) → UPDATE in Mattermost
```

#### Mapping ERP Roles to Mattermost Roles

| ERP Role | Mattermost Role | Channel Memberships |
|---|---|---|
| `super_admin` | System Admin | All channels (admin access) |
| `qc_manager` | Team Admin | QC Team, All Announcements, Department Heads |
| `qc_staff` | Member | QC Team, relevant production line channels |
| `prod_manager` | Team Admin | Production Team, All Announcements, Department Heads |
| `prod_staff` | Member | Their production line, shift-specific channel |
| `line_leader` | Channel Admin | Their line's channel (as admin) |

#### API Calls to Create a User

```javascript
// POST /api/v4/users
// This is what the sync service sends to Mattermost:
{
  "email": "jane.doe@factory.com",
  "username": "jane.doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "password": "temporary-random-password",  // Will be reset on first login
  "position": "QC Manager"
}
```

The sync service then sets a "reset password on next login" flag so the user chooses their own password.

#### API Calls to Deactivate a User

```javascript
// DELETE /api/v4/users/{user_id}
// Single call. User is instantly deactivated.
// They cannot log in, receive push notifications, or access any data.
```

#### Code Sketch — Sync Service (Node.js)

```javascript
// sync-service/index.js — simplified skeleton
const axios = require('axios');
const { Pool } = require('pg');

const erpDb = new Pool({ /* ERP PostgreSQL connection */ });
const mmApi = axios.create({
  baseURL: 'https://chat.factory.com/api/v4',
  headers: { Authorization: 'Bearer YOUR_BOT_TOKEN' }
});

async function syncUsers() {
  // 1. Get active users from ERP
  const erpUsers = await erpDb.query(`
    SELECT id, email, full_name, role, is_active
    FROM users WHERE is_active = true
  `);

  // 2. Get users from Mattermost
  const mmUsers = await mmApi.get('/users?per_page=200');

  const erpEmails = new Set(erpUsers.rows.map(u => u.email));
  const mmEmails = new Set(mmUsers.data.map(u => u.email));

  // 3. Create users in MM that exist in ERP but not in MM
  for (const erpUser of erpUsers.rows) {
    if (!mmEmails.has(erpUser.email)) {
      await mmApi.post('/users', {
        email: erpUser.email,
        username: erpUser.email.split('@')[0],
        first_name: erpUser.full_name.split(' ')[0],
        last_name: erpUser.full_name.split(' ').slice(1).join(' ') || '',
        password: generateTempPassword()
      });
      console.log(`Created Mattermost user: ${erpUser.email}`);
    }
  }

  // 4. Deactivate users in MM that are not in ERP
  for (const mmUser of mmUsers.data) {
    if (!erpEmails.has(mmUser.email) && mmUser.delete_at === 0) {
      await mmApi.delete(`/users/${mmUser.id}`);
      console.log(`Deactivated Mattermost user: ${mmUser.email}`);
    }
  }
}

// Run every 60 seconds
setInterval(syncUsers, 60_000);
syncUsers(); // Run immediately on startup
```

---

### 7.2 Phase 2: Department & Role-Based Channels

**Goal:** Channels are created automatically based on departments, roles, and shifts defined in the ERP. Users are added/removed from channels automatically as their roles change.

#### Channel Naming Convention

| Channel Name | Purpose | Members |
|---|---|---|
| `#all-announcements` | Company-wide announcements | ALL active users |
| `#production-line-1` | Line 1 production chat | Line 1 staff + managers |
| `#production-line-2` | Line 2 production chat | Line 2 staff + managers |
| `#qc-team` | Quality control team | All QC staff + QC manager |
| `#night-shift` | Night shift coordination | All night shift workers |
| `#maintenance` | Maintenance team | Maintenance staff |
| `#management` | Management coordination | All managers + admin |
| `#hr-policies` | HR notices and policy changes | ALL active users |

#### Channel Membership Reconciliation

This is where Mattermost's bulk membership API shines. Instead of adding/removing users one by one, the sync service computes the **desired member list** for each channel and sends it in a single call.

```javascript
async function reconcileChannel(channelId, desiredUserIds) {
  // PUT /api/v4/channels/{channel_id}/members
  // This endpoint:
  // 1. Adds users in `desiredUserIds` who are not currently in the channel
  // 2. Removes users currently in the channel who are NOT in `desiredUserIds`
  // 3. Preserves existing members who are in both lists
  // All in ONE atomic operation.
  await mmApi.put(`/channels/${channelId}/members`, {
    members: desiredUserIds
  });
}
```

**With this API, the sync logic is trivial:**

```javascript
async function syncChannelMemberships() {
  // Define channel membership rules based on ERP data
  const rules = await getChannelMembershipRules();
  
  for (const rule of rules) {
    // rule.channelId = Mattermost channel ID
    // rule.memberFilter = SQL query to get members
    const members = await erpDb.query(rule.memberFilter);
    const userIds = members.rows.map(m => m.mattermost_user_id);
    
    await reconcileChannel(rule.channelId, userIds);
  }
}
```

#### Channel Membership Rules — Defined Once in the ERP

| Channel | Membership SQL (conceptual) |
|---|---|
| `#qc-team` | `SELECT user_id FROM users WHERE role IN ('qc_manager', 'qc_staff')` |
| `#production-line-1` | `SELECT user_id FROM users WHERE production_line = 1 OR role IN ('prod_manager', 'super_admin')` |
| `#night-shift` | `SELECT user_id FROM users WHERE shift = 'night'` |
| `#all-announcements` | `SELECT user_id FROM users WHERE is_active = true` |

---

### 7.3 Phase 3: ERP-Driven Notifications & Alerts

**Goal:** The ERP sends automatic messages to Mattermost channels when important events happen — no manual effort, no delay.

#### Types of Notifications

| Event | Channel | What Gets Sent |
|---|---|---|
| QC check fails (weight out of spec) | `#qc-team` | "🚨 ALERT: Line 2, Head 4 — String weight TOO LOW (18.2g). Needs immediate attention." |
| Machine downtime detected | `#maintenance` + relevant line channel | "⚠️ Machine 3 on Line 2 has been down for 30 minutes. Production impact: 1,200 units."
| Shift starts | `#all-announcements` | "🔄 Morning shift started. 42 workers checked in."
| Production target achieved | `#production-line-1` | "🎉 Line 1 has reached 85% of today's target. Current output: 8,500 units."
| New employee onboarded | `#management` | "👋 Jane Doe (QC Manager) joined the company today. She has been added to the relevant channels automatically." |

#### How It Works — Webhooks

Every Mattermost channel can have an **incoming webhook** — a unique URL that accepts an HTTP POST and posts the message to that channel.

```javascript
// Sending a QC alert from the ERP:
await axios.post('https://chat.factory.com/hooks/xxxxx', {
  text: `🚨 **ALERT:** Line 2, Head 4 — String weight **TOO LOW** (18.2g).\n\nImmediate QC review required.`,
  username: 'QC Bot',
  icon_url: 'https://erp.factory.com/icons/qc-bot.png'
});
```

#### Structured Notifications with Attachments

For richer notifications (with color coding and fields):

```javascript
await axios.post('https://chat.factory.com/hooks/xxxxx', {
  attachments: [{
    color: '#FF1744',  // Red for alerts
    title: 'QC Alarm — String Weight Out of Spec',
    fields: [
      { title: 'Machine', value: 'Line 2 — Head 4', short: true },
      { title: 'Reading', value: '18.2g (Target: 20-22g)', short: true },
      { title: 'Operator', value: 'John Smith', short: true },
      { title: 'Time', value: new Date().toLocaleTimeString(), short: true }
    ],
    text: 'This machine requires immediate QC attention.'
  }]
});
```

---

### 7.4 Phase 4: Single Sign-On (SSO)

**Goal:** Users log into the ERP and are automatically logged into Mattermost without entering their password twice.

#### Approach: OAuth 2.0 / OpenID Connect

Since the free Team Edition of Mattermost does not include SAML/SSO, we build a simple **OAuth 2.0 proxy**:

```
User visits:
  chat.factory.com
      │
      ▼
OAuth Proxy (Node.js/Express)
      │
      ├── Is user already authenticated in ERP? (check session cookie)
      │     ├── YES → Proxy creates a Mattermost session token → redirect to chat
      │     └── NO → Redirect to ERP login page
      │
      ▼
After ERP login → create Mattermost session → user is in chat
```

The proxy uses Mattermost's API to create a session for the user:

```javascript
// POST /api/v4/users/login
// Create a session token for the user on the Mattermost server:
const response = await axios.post('https://mattermost:8065/api/v4/users/login', {
  login_id: user.email,
  password: user.mattermost_password
});

// The response contains a token cookie that can be set on the user's browser.
// The proxy sets this cookie and redirects to Mattermost.
```

**This is optional.** For Phase 1, users can simply have separate Mattermost passwords. SSO can be added later without disrupting existing users.

---

## 8. Detailed Implementation Guide

### 8.1 Deploying Mattermost

#### Step 1: Provision a Server

| Spec | Recommended |
|---|---|
| **CPU** | 2 vCPUs |
| **RAM** | 4 GB |
| **Storage** | 40 GB SSD |
| **OS** | Ubuntu 22.04 LTS |
| **Cost** | ~$15-20/month (DigitalOcean, Linode, or any VPS) |

Alternatively, run it on the same server as the ERP if there is capacity.

#### Step 2: Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

#### Step 3: Deploy Mattermost

```bash
# Create directory
mkdir ~/mattermost && cd ~/mattermost

# Download Docker Compose file
wget https://raw.githubusercontent.com/mattermost/docker/main/docker-compose.yml

# Create environment file
cat > .env << 'EOF'
DOMAIN=chat.factory.com
POSTGRES_PASSWORD=your_strong_password_here
SITE_URL=https://chat.factory.com
EOF

# Start all services
docker compose up -d
```

Wait 60 seconds for the database to initialize, then visit `https://chat.factory.com`.

#### Step 4: Initial Configuration

1. Open the web UI and complete the first-run wizard.
2. Create the first **System Admin** account (this will be the architect's account).
3. Configure email settings (so Mattermost can send password reset emails).
4. Enable **User Access Tokens** in System Console → Integrations → Integration Management.
5. Create a **Bot Account** for the sync service (System Console → Bot Accounts → Create Bot Account). Give it `system_admin` permissions. Save the access token — this is the secret the sync service uses.

#### Step 5: Create Core Teams and Channels

Through the Mattermost UI or API:

1. Create a **Team** called "Starium Factory" (or the company name).
2. Create the initial channels: `#all-announcements`, `#general`, `#off-topic`.
3. The sync service will create additional channels as needed.

---

### 8.2 The Sync Service (Bridge App)

#### Technology Choice

| Option | Pros | Cons |
|---|---|---|
| **Node.js** | Same stack as the ERP (if ERP uses Node). Async I/O is perfect for API calls. NPM has excellent HTTP client libraries (axios). | Requires Node runtime (likely already installed for the ERP). |
| **Python** | Simple, readable. The cron-like pattern is natural. Excellent PostgreSQL support (psycopg2). | Slower for high-frequency sync loops (not relevant here — we sync every 60 seconds). |
| **Go** | Fast, compiles to a single binary. Excellent for long-running services. | More complex to write. Not necessary for this use case. |

**Recommendation: Node.js** — because the ERP frontend is React and the backend may already be Node.js. The architect can reuse skills.

#### Directory Structure

```
sync-service/
├── package.json
├── src/
│   ├── index.js              # Entry point — starts the sync loop
│   ├── config.js             # Configuration (database URL, MM API URL, token)
│   ├── db.js                 # Database connection and queries
│   ├── mattermost-client.js  # Mattermost API wrapper
│   ├── user-sync.js          # User provisioning/deprovisioning logic
│   ├── channel-sync.js       # Channel membership reconciliation
│   ├── notification-router.js # Routes ERP events to the right channels
│   └── log.js                # Logging
├── .env                      # Environment variables (secrets)
└── Dockerfile
```

#### Core Logic — Mattermost API Client

```javascript
// mattermost-client.js
const axios = require('axios');

class MattermostClient {
  constructor(baseUrl, token) {
    this.api = axios.create({
      baseURL: `${baseUrl}/api/v4`,
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // ---- USERS ----

  async getUsers(options = {}) {
    const { data } = await this.api.get('/users', { params: options });
    return data;
  }

  async createUser({ email, username, firstName, lastName, password, position }) {
    const { data } = await this.api.post('/users', {
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      password,
      position
    });
    return data;
  }

  async deactivateUser(userId) {
    await this.api.delete(`/users/${userId}`);
  }

  async updateUser(userId, updates) {
    const { data } = await this.api.put(`/users/${userId}`, updates);
    return data;
  }

  // ---- CHANNELS ----

  async getChannels(teamId) {
    const { data } = await this.api.get(`/teams/${teamId}/channels`);
    return data;
  }

  async createChannel(teamId, { name, displayName, purpose, type = 'O' }) {
    // type: 'O' = public, 'P' = private
    const { data } = await this.api.post('/channels', {
      team_id: teamId,
      name,
      display_name: displayName,
      purpose,
      type
    });
    return data;
  }

  async setChannelMembers(channelId, memberIds, adminIds = []) {
    // This is the bulk reconciliation endpoint (Mattermost v11+)
    const { data } = await this.api.put(`/channels/${channelId}/members`, {
      members: memberIds,
      channel_admins: adminIds
    });
    return data;
  }

  // ---- MESSAGES ----

  async postMessage(channelId, { text, username, iconUrl, attachments }) {
    const { data } = await this.api.post(`/channels/${channelId}/posts`, {
      message: text,
      props: {
        attachments,
        from_webhook: username ? username : undefined,
        override_icon_url: iconUrl
      }
    });
    return data;
  }
}

module.exports = MattermostClient;
```

#### Core Logic — User Sync

```javascript
// user-sync.js
async function syncUsers(db, mmClient) {
  // 1. Fetch all active ERP users
  const erpUsers = await db.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.is_active,
           r.name as role_name
    FROM users u
    LEFT JOIN user_roles r ON r.id = u.role_id
    WHERE u.deleted_at IS NULL
  `);

  // 2. Fetch all Mattermost users (paginated)
  let mmUsers = [];
  let page = 0;
  while (true) {
    const batch = await mmClient.getUsers({ page, per_page: 200 });
    if (batch.length === 0) break;
    mmUsers = mmUsers.concat(batch);
    page++;
  }

  // 3. Build lookup maps
  const erpByEmail = new Map(erpUsers.map(u => [u.email.toLowerCase(), u]));
  const mmByEmail = new Map(mmUsers.map(u => [u.email.toLowerCase(), u]));

  // 4. Create users in Mattermost that don't exist yet
  for (const erpUser of erpUsers) {
    if (!mmByEmail.has(erpUser.email.toLowerCase())) {
      const tempPassword = crypto.randomBytes(12).toString('hex');
      const newUser = await mmClient.createUser({
        email: erpUser.email,
        username: erpUser.email.split('@')[0],
        firstName: erpUser.first_name,
        lastName: erpUser.last_name,
        password: tempPassword,
        position: erpUser.role_name
      });

      // Store the Mattermost user ID in the ERP database
      await db.query(
        'UPDATE users SET mattermost_user_id = $1 WHERE id = $2',
        [newUser.id, erpUser.id]
      );

      // Send welcome email with login instructions
      await sendWelcomeEmail(erpUser.email, tempPassword);
      logger.info(`Created Mattermost user: ${erpUser.email}`);
    }
  }

  // 5. Deactivate users in Mattermost who are deactivated/fired in ERP
  for (const mmUser of mmUsers) {
    if (mmUser.delete_at !== 0) continue; // Already deactivated

    // Check if this MM user exists in ERP at all
    const erpUser = erpByEmail.get(mmUser.email.toLowerCase());
    if (!erpUser || !erpUser.is_active) {
      await mmClient.deactivateUser(mmUser.id);
      logger.info(`Deactivated Mattermost user: ${mmUser.email}`);
    }
  }

  // 6. Update existing users whose details changed
  for (const [email, mmUser] of mmByEmail) {
    const erpUser = erpByEmail.get(email);
    if (!erpUser) continue;

    const needsUpdate =
      mmUser.first_name !== erpUser.first_name ||
      mmUser.last_name !== erpUser.last_name;

    if (needsUpdate) {
      await mmClient.updateUser(mmUser.id, {
        first_name: erpUser.first_name,
        last_name: erpUser.last_name
      });
      logger.info(`Updated Mattermost user: ${email}`);
    }
  }
}
```

#### Core Logic — Channel Sync

```javascript
// channel-sync.js
const CHANNEL_DEFINITIONS = [
  {
    name: 'all-announcements',
    display_name: 'All Announcements',
    purpose: 'Company-wide announcements and notices.',
    type: 'O', // Public
    memberFilter: 'SELECT mm_id FROM users WHERE is_active = true'
  },
  {
    name: 'production-line-1',
    display_name: 'Production Line 1',
    purpose: 'Line 1 production team communication.',
    type: 'O',
    memberFilter: `
      SELECT mm_id FROM users
      WHERE is_active = true
        AND (production_line_id = 1
          OR role IN ('super_admin', 'prod_manager'))
    `
  },
  {
    name: 'qc-team',
    display_name: 'QC Team',
    purpose: 'Quality Control team discussions and alerts.',
    type: 'O', // Public within the team
    memberFilter: `
      SELECT mm_id FROM users
      WHERE is_active = true
        AND role IN ('qc_manager', 'qc_staff', 'super_admin')
    `
  },
  {
    name: 'night-shift',
    display_name: 'Night Shift',
    purpose: 'Night shift coordination.',
    type: 'O',
    memberFilter: `
      SELECT mm_id FROM users
      WHERE is_active = true
        AND shift = 'night'
    `
  },
  {
    name: 'management',
    display_name: 'Management',
    purpose: 'Management-level discussions.',
    type: 'P', // Private — only managers
    memberFilter: `
      SELECT mm_id FROM users
      WHERE is_active = true
        AND role IN ('super_admin', 'qc_manager', 'prod_manager')
    `
  },
  {
    name: 'maintenance',
    display_name: 'Maintenance Team',
    purpose: 'Equipment maintenance and downtime coordination.',
    type: 'O',
    memberFilter: `
      SELECT mm_id FROM users
      WHERE is_active = true
        AND department = 'maintenance'
    `
  }
];

async function syncChannels(db, mmClient, teamId) {
  // 1. Get existing channels from Mattermost
  const existingChannels = await mmClient.getChannels(teamId);
  const existingByName = new Map(existingChannels.map(c => [c.name, c]));

  for (const def of CHANNEL_DEFINITIONS) {
    let channel = existingByName.get(def.name);

    // 2. Create channel if it doesn't exist
    if (!channel) {
      channel = await mmClient.createChannel(teamId, {
        name: def.name,
        displayName: def.display_name,
        purpose: def.purpose,
        type: def.type
      });
      logger.info(`Created channel: ${def.name}`);
    }

    // 3. Get desired members from ERP
    const members = await db.query(def.memberFilter);
    const memberIds = members.rows
      .map(r => r.mm_id)
      .filter(id => id !== null);

    // 4. Reconcile channel membership (bulk API)
    if (memberIds.length > 0) {
      await mmClient.setChannelMembers(channel.id, memberIds);
      logger.info(`Synced ${memberIds.length} members to channel: ${def.name}`);
    }
  }
}
```

---

### 8.3 User Lifecycle Management

#### Onboarding Flow

```
HR creates user in ERP
        │
        ▼
ERP inserts user record (is_active = true)
        │
        ▼
Sync Service (running every 60s):
  1. Detects new user in ERP, not in Mattermost
  2. Creates Mattermost account
  3. Stores Mattermost user_id in ERP database
  4. Sends welcome email with temporary password and Mattermost URL
        │
        ▼
Next sync cycle (60s later):
  5. Channel sync runs
  6. User is added to all channels they should belong to
  7. User opens Mattermost → sees their channels populated
```

#### Offboarding Flow

```
HR deactivates user in ERP (set is_active = false)
        │
        ▼
Sync Service (running every 60s):
  1. Detects user is inactive in ERP
  2. Deactivates Mattermost account via API
  3. User is removed from ALL channels (because the next channel sync
     reconciles membership, and this user is no longer in the member queries)
        │
        ▼
User tries to log in → Mattermost returns "account deactivated"
All messages, channels, and data are inaccessible.
```

#### Role Change Flow

```
HR changes user's role (e.g., from prod_staff to qc_manager)
        │
        ▼
Sync Service (running every 60s):
  1. User sync detects no change needed (user still active)
  2. Channel sync reconciles memberships:
     - User is REMOVED from production line channels
     - User is ADDED to qc-team channel
     - User is ADDED to management channel (if applicable)
        │
        ▼
User refreshes Mattermost → old channels gone, new channels appear
```

---

### 8.4 Channel Management

#### Adding a New Channel Type

To add a new channel (e.g., `#supply-chain`):

1. Add a new entry to `CHANNEL_DEFINITIONS` in the sync service code:

```javascript
{
  name: 'supply-chain',
  display_name: 'Supply Chain',
  purpose: 'Procurement, logistics, and supplier coordination.',
  type: 'O',
  memberFilter: `
    SELECT mm_id FROM users
    WHERE is_active = true
      AND department = 'procurement'
  `
}
```

2. Deploy the updated sync service.
3. On the next sync cycle, the channel is created and populated.

No manual intervention. No requests to IT. No waiting.

#### Channel Archival

When a channel is no longer needed (e.g., a project ends), archive it:

```javascript
// DELETE /api/v4/channels/{channel_id}
await mmApi.delete(`/channels/${channelId}`);
```

Users lose access. Messages are preserved for compliance but not visible to anyone.

---

### 8.5 Sending Notifications from the ERP

#### Direct API Method

For the tightest integration, send messages directly via the Mattermost API:

```javascript
// Inside the ERP codebase — e.g., when a QC check fails
const mattermost = new MattermostClient(process.env.MM_URL, process.env.MM_BOT_TOKEN);

// Route the notification to the right channel based on the machine
const qcChannelId = await getChannelForMachine('qc-team', machineId);

await mattermost.postMessage(qcChannelId, {
  text: `🚨 **QC ALERT — String Weight Out of Spec**`,
  attachments: [{
    color: '#FF1744',
    title: `Machine: ${machine.name} — Head ${check.headNumber}`,
    fields: [
      { title: 'Reading', value: `${check.weight}g`, short: true },
      { title: 'Target Range', value: `${spec.min}g — ${spec.max}g`, short: true },
      { title: 'Check Type', value: 'String Weight Round 1', short: true },
      { title: 'Operator', value: check.operatorName, short: true },
      { title: 'Status', value: check.status, short: true },
      { title: 'Time', value: new Date(check.createdAt).toLocaleString(), short: true }
    ],
    text: `[View in ERP](${process.env.ERP_URL}/qc-sachet-production-checks)`
  }]
});
```

#### Webhook Method (Simpler)

Every Mattermost channel can have an incoming webhook URL. This is the simplest way to send messages from any system, including shell scripts, IoT devices, or third-party services:

```bash
# From a bash script — e.g., a machine sends an alert
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "⚠️ Machine 3 temperature exceeds threshold: 92°C",
    "username": "Machine Monitor",
    "icon_emoji": ":robot:"
  }' \
  https://chat.factory.com/hooks/abc123def456
```

#### Creating Bot Accounts for Different Purposes

| Bot | Purpose |
|---|---|
| **QC Bot** | Sends quality alerts and test results |
| **Production Bot** | Sends shift start/end, production targets, output updates |
| **Maintenance Bot** | Sends downtime alerts, maintenance reminders |
| **HR Bot** | Sends onboarding/offboarding notices, policy changes |
| **System Bot** | Sends system status, backup completion, error alerts |

---

### 8.6 Embedding Chat into the ERP

Users should not need to switch between the ERP and the chat app. We can embed Mattermost directly inside the ERP interface.

#### Option A: iframe Embed (Quickest)

```jsx
// Inside the ERP React app
function ChatPanel() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 60px)' }}>
      <iframe
        src="https://chat.factory.com"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone"
      />
    </div>
  );
}
```

**Pros:** Trivial to implement. Full Mattermost experience.
**Cons:** Requires users to be logged into both systems (unless SSO is set up). Separate URL bar.

#### Option B: Embedded Sidebar (Better)

A smaller Mattermost view as a sidebar panel in the ERP:

```jsx
// A collapsible chat sidebar in the ERP
import { useState } from 'react';

function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="chat-toggle">
        💬
      </button>

      {isOpen && (
        <div className="chat-sidebar">
          <iframe
            src={`https://chat.factory.com/pl/plugins/sidebar`}
            width="380"
            height="100%"
            style={{ border: 'none' }}
          />
        </div>
      )}
    </>
  );
}
```

#### Option C: API-Powered Notification Feed (Lightest)

Instead of embedding the full chat app, show a notification feed inside the ERP that pulls recent messages from Mattermost channels relevant to the current user:

```javascript
// GET /api/v4/channels/{channel_id}/posts?per_page=10
const { data } = await axios.get(
  `https://chat.factory.com/api/v4/channels/${qcChannelId}/posts?per_page=10`,
  { headers: { Authorization: `Bearer ${userToken}` } }
);

// Display in a "Recent Messages" widget on the ERP dashboard
```

---

## 9. Disaster Recovery & Backup

### Database Backup

Mattermost stores everything in PostgreSQL. Back up daily:

```bash
#!/bin/bash
# backup-mattermost.sh — run daily via cron
DATE=$(date +%Y-%m-%d)
docker exec mattermost-postgres pg_dump -U mattermost mattermost \
  | gzip > /backups/mattermost-db-$DATE.sql.gz

# Keep 30 days of backups
find /backups -name "mattermost-db-*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
aws s3 cp /backups/mattermost-db-$DATE.sql.gz s3://factory-backups/mattermost/
```

### File Storage Backup

User-uploaded files (images, PDFs) are stored in a volume directory:

```bash
tar -czf /backups/mattermost-files-$DATE.tar.gz /var/lib/docker/volumes/mattermost-data/
```

### Restore Procedure

```bash
# 1. Stop Mattermost
docker compose down

# 2. Restore database
gunzip -c /backups/mattermost-db-2026-07-01.sql.gz \
  | docker exec -i mattermost-postgres psql -U mattermost

# 3. Restore files
tar -xzf /backups/mattermost-files-2026-07-01.tar.gz -C /

# 4. Start Mattermost
docker compose up -d
```

### Recovery Time Objective (RTO)

- **Database restore:** ~15 minutes
- **Full server rebuild (new VPS + restore):** ~1 hour

---

## 10. Security & Compliance

### Data Encryption

| At Rest | In Transit |
|---|---|
| PostgreSQL data-at-rest encryption | TLS 1.3 for all HTTP traffic |
| File storage encrypted at OS level (dm-crypt/LUKS) | Let's Encrypt SSL certificates (auto-renewed) |
| Database backups encrypted with GPG | Mattermost API calls over HTTPS only |

### Access Control

| Layer | Control |
|---|---|
| **Mattermost login** | Email + strong password. Enforce 2FA for admin accounts. |
| **API access** | Bot tokens with specific permissions (never use a personal account token). |
| **Channel access** | Public channels (discoverable, anyone in the team can join). Private channels (invite-only). |
| **Admin actions** | Only the sync service bot and the architect's account have system admin privileges. No other user can deactivate accounts or modify channel memberships. |

### Audit Logging

Mattermost's **compliance exports** (available in Team Edition?) can export all messages in JSON/CSV format daily. This is useful for:

- HR investigations
- Quality incident reviews
- Regulatory compliance

If compliance exports are not available in Team Edition, the sync service can run a periodic export:

```javascript
// Export all messages from the last 24 hours
async function exportDailyMessages(mmClient, teamId) {
  const channels = await mmClient.getChannels(teamId);
  const allPosts = [];

  for (const channel of channels) {
    const posts = await mmClient.getPosts(channel.id, {
      since: Date.now() - 24 * 60 * 60 * 1000
    });
    allPosts.push({ channel: channel.name, posts });
  }

  // Write to encrypted file
  const fs = require('fs');
  fs.writeFileSync(
    `/exports/messages-${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(allPosts, null, 2)
  );
}
```

### Data Retention Policy

| Data Type | Retention Period |
|---|---|
| Regular messages | Indefinite (or configure auto-deletion after N years) |
| File uploads | 1 year (or as required by compliance) |
| Deactivated user data | Anonymized after 90 days |
| Audit logs | 3 years |

---

## 11. Cost Breakdown

### Hardware / Hosting

| Item | Cost (Monthly) | Notes |
|---|---|---|
| **VPS (2 CPU, 4 GB RAM, 40 GB SSD)** | $15-20 | DigitalOcean, Linode, Vultr, or Hetzner |
| **Domain name (chat.factory.com)** | $1-2 | Already may own one |
| **SSL certificate** | $0 | Let's Encrypt — free, auto-renewing |

### Software

| Item | Cost | Notes |
|---|---|---|
| **Mattermost Team Edition** | $0 | MIT license — completely free |
| **PostgreSQL** | $0 | Open source — included in Docker Compose |
| **Nginx** | $0 | Open source reverse proxy |
| **Jitsi Meet (optional — video calls)** | $0 | Free, self-hosted |

### Development

| Item | Effort | Who |
|---|---|---|
| **Deploy Mattermost** | 2-4 hours | In-house architect |
| **Write sync service** | 3-5 days | In-house architect |
| **Define channel membership rules** | 1 day | HR + architect |
| **Integrate notifications from ERP** | 2-3 days | In-house architect |
| **Set up SSO (optional — Phase 4)** | 2-3 days | In-house architect |

### Total First-Year Cost

| Item | Cost |
|---|---|
| **Hosting** | $180-240/year |
| **Domain** | $12-24/year |
| **Architect's time (one-time)** | Part of their salary — no external vendor fees |
| **Total** | **~$200-265/year** |

Compare this to:
- **Slack Pro:** $8.75/user/month × 200 users = **$21,000/year**
- **Microsoft Teams Business Basic:** $6/user/month × 200 users = **$14,400/year**
- **WhatsApp Business API:** ~$0.005/message × unknown volume + integration costs
- **Self-hosted Mattermost:** **~$200/year + architect's time**

---

## 12. Migration from WhatsApp

### Step 1: Introduction & Beta (Week 1)

1. Deploy Mattermost.
2. Create accounts for 5-10 power users (managers, team leads).
3. They use Mattermost alongside WhatsApp for 1 week.
4. Gather feedback. Fix any issues.

### Step 2: Department Rollout (Week 2-3)

1. Enable sync service for all users.
2. Announce the move in a company meeting. Explain **why** (no more manual management, one place for everything, works on phones).
3. Distribute login instructions (simple one-pager with screenshots).
4. HR sends everyone their login details via their personal email/SMS.

### Step 3: The Switch (Week 4)

1. All company communication moves to Mattermost.
2. WhatsApp groups are set to "read-only" mode (admins stop posting new information there).
3. Important announcements include: "For details, check Mattermost."
4. The sync service is now active and handling all user lifecycle events.

### Step 4: WhatsApp Retirement (Week 6)

1. WhatsApp groups are archived or deleted.
2. A bot posts a final message: "This group is no longer active. All company communication now happens on Mattermost at chat.factory.com."
3. The sync service is monitored for any edge cases.

### Managing Resistance

People resist change. Here is how to handle it:

| Objection | Response |
|---|---|
| "I already have WhatsApp, why learn something new?" | "WhatsApp works for chatting with friends. For work, we need a system that automatically manages access, keeps records, and integrates with the factory ERP. You will have one login, one app, and all your work communication in one place." |
| "Will it work on my phone?" | "Yes. Mattermost has a free app for iPhone and Android. It works on any internet connection — WiFi or mobile data." |
| "What about the history on WhatsApp?" | "Important decisions, SOPs, and announcements will be reposted to Mattermost. Old WhatsApp conversations are not moved (most of them are noise anyway)." |
| "This is too complicated." | "You join a few channels based on your role. That is it. If you can use WhatsApp groups, you can use Mattermost. The interface is simpler than WhatsApp." |

---

## 13. Glossary

Terms explained for non-technical readers:

| Term | Plain English Meaning |
|---|---|
| **API (Application Programming Interface)** | A way for one computer program to talk to another. When the ERP needs to create a user in Mattermost, it sends an API request. Think of it like a waiter taking an order from the kitchen to the customer. |
| **REST API** | A specific style of API that uses standard web addresses (URLs) and HTTP methods (GET = read, POST = create, PUT = update, DELETE = remove). It is the most common way modern software communicates. |
| **Self-hosted** | The software runs on the company's own server, not on someone else's cloud. Like owning your own building vs renting office space. |
| **Docker / Docker Compose** | A tool that packages software into containers so it runs the same way on any computer. Like a shipping container — you pack it once, and it travels anywhere without repacking. |
| **PostgreSQL** | A database — like a highly organized filing cabinet where data is stored and retrieved. |
| **VPS (Virtual Private Server)** | A rented computer in a data center that runs 24/7. Like renting a small apartment for your software. |
| **SSO (Single Sign-On)** | One login for all systems. Log in once to the ERP, and you are automatically logged into Mattermost, email, and other tools. |
| **Webhook** | A simple way for one system to send a message to another when something happens. Like a doorbell — press the button, and the bell rings on the other side. |
| **Bot** | An automated account that posts messages or performs actions. Not a human — a program. |
| **OAuth 2.0** | An industry standard for letting one system securely access another on behalf of a user. Like a valet key — gives limited access for a specific purpose. |
| **TLS / HTTPS** | Encryption protocols that scramble data so no one can read it while it travels over the internet. Like a sealed, armored envelope. |
| **Nginx** | A web server that acts as a traffic cop — routing requests, handling encryption, and protecting the backend. |
| **Sync Service** | A small program that runs continuously and keeps two systems in sync (ERP and Mattermost). Like a translator who ensures two people always have the same information. |
| **Channel** | A dedicated chat room for a specific topic or team (like a WhatsApp group, but organized and manageable by code). |
| **Federation** | The ability for different chat servers to talk to each other. Like email — a Gmail user can email an Outlook user without both using the same service. |

---

## 14. Implementation Plan — Phases, Timeline & Milestones

This section ties together every component described above into a single, phased rollout plan. Each phase builds on the previous one, with clear deliverables, timelines, and success criteria.

---

### Phase 0: Foundation (Week 1)

**Goal:** Deploy Mattermost and establish the core infrastructure.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Provision a VPS (2 CPU, 4 GB RAM) | Architect | 30 min | Server ready, SSH access configured |
| Install Docker and Docker Compose | Architect | 15 min | Docker engine running |
| Deploy Mattermost via Docker Compose | Architect | 30 min | Mattermost accessible at `https://chat.factory.com` |
| Configure SSL (Let's Encrypt via Nginx) | Architect | 20 min | HTTPS working, auto-renewal set up |
| Create the "Starium Factory" team | Architect | 5 min | Team created in Mattermost |
| Create initial channels: `#general`, `#all-announcements`, `#off-topic` | Architect | 10 min | Base channels exist |
| Create a bot account for the sync service | Architect | 10 min | Bot token generated and saved |
| Set up daily database backups | Architect | 30 min | Cron job running, test restore verified |
| Configure email settings (SMTP) for password resets | Architect | 20 min | Mattermost can send emails |

**Milestone:** ✅ Mattermost is live, accessible from any device, and accepting logins.

---

### Phase 1: Sync Service Development (Week 2-3)

**Goal:** Build the bridge between the ERP and Mattermost so user accounts and channel memberships are automatically managed.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Set up sync service project structure (Node.js) | Architect | 1 day | Repository with package.json, config, logger |
| Implement Mattermost API client wrapper | Architect | 1 day | `MattermostClient` class with user, channel, message methods |
| Implement ERP database queries for user data | Architect | 1 day | SQL queries for active users, roles, departments |
| Implement user sync logic (create/update/deactivate) | Architect | 2 days | Sync loop creates new users, deactivates removed users, updates changed users |
| Implement channel membership reconciliation | Architect | 2 days | Sync loop computes desired membership per channel and calls bulk API |
| Define channel membership rules for all departments | Architect + HR | 1 day | Complete `CHANNEL_DEFINITIONS` array covering all roles and departments |
| Implement notification logger (audit trail of sync actions) | Architect | 0.5 days | Every user created/deactivated and membership change is logged |
| Test with synthetic data | Architect | 1 day | Create test users in ERP, verify they appear in Mattermost with correct channel memberships |
| Write Dockerfile and deploy sync service | Architect | 0.5 days | Sync service running as a Docker container alongside Mattermost |
| Monitor and fix edge cases | Architect | 1 day | All edge cases handled (email collisions, username conflicts, network interruptions) |

**Milestone:** ✅ Creating a user in the ERP automatically creates their Mattermost account and adds them to the correct channels. Deactivating a user in the ERP instantly deactivates their Mattermost account and removes them from all channels.

---

### Phase 2: Pilot Rollout — Management & QC Team (Week 4)

**Goal:** Validate the system with a small group of power users before company-wide rollout.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Identify 10-15 pilot users (managers, team leads, QC team) | HR + Management | 1 day | Pilot group list |
| Sync pilot users to Mattermost via the sync service | Architect | 1 hour | All pilot users have Mattermost accounts |
| Send welcome emails with login instructions and temporary passwords | Architect + HR | 1 hour | Each pilot user receives their login credentials |
| Provide a 1-page quick-start guide (how to install the app, log in, find channels) | Architect | 2 hours | PDF guide distributed to pilot users |
| Conduct a 30-minute walkthrough session (video call or in-person) | Architect | 1 hour | Pilot users understand how to use chat |
| Run pilot for 1 week — pilot users use Mattermost alongside WhatsApp | All pilot users | 1 week | Real usage data and feedback collected |
| Collect feedback (what is confusing, what is missing, what needs improvement) | Architect | 1 day | Feedback document with action items |
| Fix issues identified in feedback | Architect | 2-3 days | Iteration on sync service and configuration |

**Milestone:** ✅ Pilot users are actively using Mattermost. Feedback has been addressed. The system is stable and ready for company-wide rollout.

---

### Phase 3: Company-Wide Rollout (Week 5-6)

**Goal:** Move all employees from WhatsApp to Mattermost.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Announce the migration in an all-hands meeting | HR + Management | 1 hour | Everyone knows the plan, timeline, and reasons |
| Distribute quick-start guides (printed + digital) | HR | 1 day | Every employee has login instructions |
| Sync all employees to Mattermost | Architect | 1 hour (automated) | All active employees have accounts and are in correct channels |
| Deploy the Mattermost mobile app installation guide for Android and iOS | Architect | 2 hours | Internal page with direct app store links and setup instructions |
| Set WhatsApp groups to read-only | HR | 1 hour | Admins stop posting new information to WhatsApp |
| Post a pinned message in each Mattermost channel explaining its purpose | Architect | 2 hours | Every channel has a clear description and usage guidelines |
| First week: monitor adoption metrics (daily active users, messages sent) | Architect | 1 hour/day | Adoption dashboard showing usage trends |
| HR stops using WhatsApp for official communication | HR | Immediate | All official communication is now on Mattermost |

**Milestone:** ✅ All employees are active on Mattermost. WhatsApp is no longer used for company communication. The sync service is handling user lifecycle events without issues.

---

### Phase 4: ERP Notification Integration (Week 7-8)

**Goal:** The ERP automatically sends notifications to Mattermost channels when important events occur.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Create notification bot accounts (QC Bot, Production Bot, Maintenance Bot, HR Bot) | Architect | 1 hour | 4 bot accounts with API tokens |
| Implement QC alert routing — send alerts when string weight / bag inspection / carton inspection fails | Architect | 2 days | QC failures post color-coded alerts to `#qc-team` channel |
| Implement production notification routing — shift start/end, output updates, target achievements | Architect | 2 days | Production events post to relevant line channels |
| Implement maintenance notification routing — machine downtime, maintenance reminders, equipment status | Architect | 2 days | Maintenance events post to `#maintenance` channel |
| Implement HR notification routing — onboarding/offboarding notices, policy changes | Architect | 1 day | HR events post to `#all-announcements` and `#management` |
| Implement notification preference settings in the ERP (which events go to which channels) | Architect | 2 days | Configuration page in ERP for notification routing rules |
| Add "View in ERP" links to notifications so users can click through directly | Architect | 1 day | Notifications include deep links to the relevant ERP page |
| Test all notification flows with real ERP events | Architect | 1 day | Every notification type verified end-to-end |

**Milestone:** ✅ The ERP proactively notifies the right teams in real time. A QC failure on Line 2 automatically alerts the QC team in Mattermost with machine details, readings, and a direct link to the ERP.

---

### Phase 5: Embedding & SSO (Week 9-10)

**Goal:** Remove friction by integrating Mattermost into the ERP interface and enabling single sign-on.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Build OAuth 2.0 proxy for SSO | Architect | 2 days | Users logged into the ERP are automatically logged into Mattermost |
| Test SSO flow across browsers and mobile | Architect | 1 day | SSO works on all devices |
| Add embedded chat sidebar to the ERP interface | Architect | 2 days | Users can access Mattermost without leaving the ERP |
| Add "Recent Messages" widget to the ERP dashboard | Architect | 1 day | Dashboard shows latest relevant messages from Mattermost |
| Test combined UX (SSO + embed) with pilot users | Architect + Pilot users | 1 day | Seamless experience confirmed |

**Milestone:** ✅ Users access chat from inside the ERP with zero additional login steps. The ERP and chat feel like one unified system.

---

### Phase 6: WhatsApp Retirement & Supplier Bridge (Week 11-12)

**Goal:** Gracefully retire WhatsApp and optionally bridge to external parties who still use it.

| Task | Owner | Estimated Time | Deliverable |
|---|---|---|---|
| Verify all employees are active on Mattermost and no one is missing | Architect + HR | 1 day | 100% active user coverage confirmed |
| Archive/deactivate remaining WhatsApp groups | HR | 1 day | WhatsApp groups are closed with final redirect messages |
| Remove WhatsApp group admin roles from all internal staff | HR | 1 day | No staff remains admin of company WhatsApp groups |
| (Optional) Set up a Matrix bridge to WhatsApp for external supplier communication | Architect | 2-3 days | Suppliers can still reach the factory via WhatsApp → bridged to Mattermost |
| (Optional) Create a `#suppliers` channel for external communication | Architect | 1 hour | Suppliers visible in the bridge channel |
| Document the final system architecture and operational procedures | Architect | 1 day | Runbook for ongoing operations |
| Train backup operator (if architect is unavailable) | Architect | 2 hours | Someone else can restart services, check logs, restore from backup |

**Milestone:** ✅ WhatsApp is fully retired for internal communication. The company has a single, unified communication platform managed entirely by the ERP.

---

### Summary Timeline

```
Week 1    Phase 0: Foundation
            ├── Deploy Mattermost server
            ├── Configure SSL, backups, email
            └── Create base channels

Week 2-3  Phase 1: Sync Service Development
            ├── Build user sync (create/update/deactivate)
            ├── Build channel membership reconciliation
            └── Test with synthetic data

Week 4    Phase 2: Pilot Rollout
            ├── 10-15 pilot users onboarded
            ├── 1 week of real usage
            └── Feedback collected and addressed

Week 5-6  Phase 3: Company-Wide Rollout
            ├── All employees onboarded
            ├── WhatsApp set to read-only
            └── Full adoption achieved

Week 7-8  Phase 4: ERP Notification Integration
            ├── QC alerts
            ├── Production notifications
            ├── Maintenance alerts
            └── HR notifications

Week 9-10 Phase 5: Embedding & SSO
            ├── Single sign-on implemented
            ├── Chat sidebar in ERP
            └── Dashboard message widget

Week 11-12 Phase 6: WhatsApp Retirement
            ├── WhatsApp groups closed
            ├── Optional supplier bridge
            └── Documentation complete

████████████████████████████████████████████████████████████████████████████████

Total project duration: 12 weeks
Total architect development time: ~25-30 days
Total external cost: ~$200-265/year (server + domain)
```

---

### Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Users resist switching from WhatsApp | Medium | High | Clear communication about benefits; pilot users become champions; management mandate |
| Sync service has a bug that creates duplicate accounts | Low | Medium | Email-based deduplication; test with synthetic data first; manual merge tool as backup |
| Mattermost server goes down | Low | High | Daily backups; Docker restart policy; monitoring alert; 1-hour RTO |
| Network on factory floor is unreliable | Medium | Medium | Mattermost mobile queues messages offline; sync service retries on failure |
| Employee forgets password | Medium | Low | Email-based password reset; HR can reset via API; quick-start guide includes instructions |
| Department restructuring requires channel changes | Low | Low | Architect updates CHANNEL_DEFINITIONS; sync service handles it in next cycle |

---

### Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| **Adoption rate** | >95% of employees active within 2 weeks of Phase 3 | Mattermost System Console → Users → Active Users |
| **Onboarding time for new hire** | <5 minutes (from ERP entry to chat access) | Timer from HR creating user to sync service confirming account creation |
| **Offboarding time for terminated staff** | <60 seconds (from ERP deactivation to chat access revoked) | Timer from deactivation to sync service confirming deactivation |
| **Notification delivery time** | <30 seconds from ERP event to Mattermost message | Application logs timestamps |
| **Channel membership accuracy** | 100% — every user is in exactly the channels they should be | Reconciliation log shows no drift |
| **User satisfaction** | >80% positive feedback in post-migration survey | Anonymous survey after Phase 6 |

---

## Appendix: Quick-Start Commands

For the architect, here are the essential commands:

```bash
# 1. Deploy Mattermost (first time)
mkdir -p ~/mattermost && cd ~/mattermost
wget https://raw.githubusercontent.com/mattermost/docker/main/docker-compose.yml
docker compose up -d

# 2. Stop Mattermost
cd ~/mattermost && docker compose down

# 3. Update Mattermost
cd ~/mattermost && docker compose pull && docker compose up -d

# 4. View logs
docker compose logs -f app

# 5. Backup database
docker exec mattermost-postgres pg_dump -U mattermost mattermost | gzip > backup.sql.gz

# 6. Restore database
gunzip -c backup.sql.gz | docker exec -i mattermost-postgres psql -U mattermost

# 7. Create a bot token (using mmctl CLI)
docker exec mattermost-app mmctl token generate bot_username

# 8. List all users (via API)
curl -s -H "Authorization: Bearer TOKEN" https://chat.factory.com/api/v4/users | jq
```

---

> **Document prepared by:** In-house Architecture Team
> **Date:** July 2026
> **Status:** Research and implementation plan complete — ready to begin Phase 0
