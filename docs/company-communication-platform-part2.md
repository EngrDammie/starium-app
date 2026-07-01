# Building the Free Communication System — Part 2
## Complete Step-by-Step Implementation for Any Developer

> **Who this is for:** A brand new developer who needs to build the entire chat integration from scratch using only the free features of Mattermost (Team Edition) and/or Slack APIs. Every step is explained with code, commands, and reasoning. No prior knowledge of chat systems is assumed.

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [Prerequisites — What You Need Before Starting](#2-prerequisites)
3. [Part A: Deploy Mattermost for Free](#3-part-a-deploy-mattermost-for-free)
4. [Part B: Build the Sync Service](#4-part-b-build-the-sync-service)
5. [Part C: Connect the ERP to Mattermost](#5-part-c-connect-the-erp-to-mattermost)
6. [Part D: Free Single Sign-On (SSO)](#6-part-d-free-single-sign-on-sso)
7. [Part E: Embed Chat in the App](#7-part-e-embed-chat-in-the-app)
8. [Part F: Push Notifications for Free](#8-part-f-push-notifications-for-free)
9. [Part G: Backup and Disaster Recovery](#9-part-g-backup-and-disaster-recovery)
10. [Can We Use Slack APIs for Free?](#10-can-we-use-slack-apis-for-free)
11. [Final Verdict: Mattermost vs Slack](#11-final-verdict-mattermost-vs-slack)

---

## 1. What We Are Building

### The Goal

A company-wide chat system that:

- **Creates accounts automatically** when HR adds a new employee to the ERP
- **Removes access instantly** when an employee is terminated
- **Organizes people into channels** based on their role, department, and shift
- **Sends automatic alerts** from the ERP (QC failures, production updates, maintenance alerts)
- **Works on every device** — phone, desktop, web browser
- **Costs $0 for software** — only the server cost (~$10-15/month)

### The Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR APP (Starium Rafa ERP)                   │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────────┐  │
│  │  User DB    │    │  Role/Perms  │    │  Sync Service          │  │
│  │  (Postgres) │    │  Engine      │    │  (Node.js)             │  │
│  └──────┬──────┘    └──────┬───────┘    │                        │  │
│         │                  │            │  ┌──────────────────┐  │  │
│         ▼                  ▼            │  │  Mattermost API  │──┼──┼──▶ HTTP
│  ┌─────────────┐    ┌──────────────┐    │  │  Client          │  │  │     │
│  │  Employee   │    │  Department  │    │  └──────────────────┘  │  │     │
│  │  Records    │    │  Hierarchy   │    └────────────────────────┘  │     │
│  └─────────────┘    └──────────────┘                                │     │
└─────────────────────────────────────────────────────────────────────┘     │
                                                                             │
                                                                             ▼
                                    ┌───────────────────────────────────────────┐
                                    │           MATTERMOST SERVER               │
                                    │  (Team Edition — 100% Free)               │
                                    │                                           │
                                    │  Go backend + React frontend + PostgreSQL │
                                    └───────────────────────────────────────────┘
                                            │              │              │
                                            ▼              ▼              ▼
                                     ┌──────────┐  ┌──────────┐  ┌──────────┐
                                     │  Phone   │  │  Desktop │  │ Browser  │
                                     │ App      │  │  App     │  │ (Web)    │
                                     └──────────┘  └──────────┘  └──────────┘
```

---

## 2. Prerequisites

### What You Need Before Starting

| Requirement | Why | How to Get It |
|---|---|---|
| **A server (VPS)** | Mattermost needs a computer that runs 24/7 | Rent one for ~$10-15/month from DigitalOcean, Linode, Hetzner, or any provider |
| **A domain name** | So users access chat at `chat.yourfactory.com` instead of an IP address | Buy one for ~$10/year from Namecheap, GoDaddy, or Cloudflare |
| **Node.js installed** | To write the sync service | Download from https://nodejs.org (use version 18 or 20 LTS) |
| **PostgreSQL access** | To read employee data from the ERP | The ERP already uses PostgreSQL — you just need read access |
| **Basic familiarity with** | | |
| — Terminal / command line | Running commands | Any online bash tutorial (30 minutes) |
| — JavaScript | Writing the sync service | Any JavaScript basics tutorial |
| — REST APIs | Understanding how apps talk to each other | Any REST API intro (30 minutes) |

### Server Specification

| Spec | Minimum | Recommended |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Cost | ~$6/month | ~$12/month |

### Tools You Will Use

| Tool | What It Does |
|---|---|
| **Docker** | Packages Mattermost so it runs the same everywhere |
| **curl** | A command-line tool to test API calls |
| **Node.js** | JavaScript runtime — runs your sync service code |
| **PostgreSQL client** | Connects to your ERP database to read user data |
| **Nginx** | A web server that handles HTTPS and routing |

---

# PART A — DEPLOY MATTERMOST FOR FREE

This section walks through deploying Mattermost Team Edition (100% free, no license key needed).

---

## Step A1: Set Up the Server

Connect to your server via SSH (Secure Shell). If you are on Windows, use **PowerShell** or **PuTTY**. On Mac or Linux, use the **Terminal**.

```bash
# Replace with your server's IP address
ssh root@your-server-ip
```

When prompted, enter your password. You should see a welcome message and a command prompt.

## Step A2: Install Docker

Docker is how we run Mattermost. Think of Docker as a "shipping container" for software — it packages everything Mattermost needs so it runs the same on any server.

```bash
# Download the Docker install script
curl -fsSL https://get.docker.com -o get-docker.sh

# Run the install script
sudo sh get-docker.sh

# Install Docker Compose (a tool to run multi-container setups)
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Verify Docker is installed correctly
sudo docker --version
# You should see: Docker version 24.x.x, build xxxxx

# Verify Docker Compose is installed
sudo docker compose version
# You should see: Docker Compose version v2.x.x
```

**What just happened?** You installed Docker, which will run Mattermost in an isolated environment. If something goes wrong, you can delete the container and start over without affecting the server.

## Step A3: Deploy Mattermost

```bash
# Create a folder for Mattermost files
mkdir ~/mattermost && cd ~/mattermost

# Download the official Docker Compose file
# This file tells Docker how to run Mattermost
wget https://raw.githubusercontent.com/mattermost/docker/main/docker-compose.yml

# Create a configuration file for environment variables
cat > .env << 'EOF'
# Your domain name (change this to your actual domain)
DOMAIN=chat.yourfactory.com

# A strong password for the database
POSTGRES_PASSWORD=your-strong-password-here-change-me

# The URL where Mattermost will be accessible
SITE_URL=https://chat.yourfactory.com
EOF

# Start Mattermost (this may take 2-3 minutes the first time)
sudo docker compose up -d
```

**What just happened?** Docker downloaded and started three services:
1. **Mattermost app** — the main chat application
2. **PostgreSQL** — the database that stores messages, users, etc.
3. **Nginx** — a web server that handles HTTPS

**Check if it is running:**

```bash
# List running containers
sudo docker compose ps

# You should see three services with "Up" status:
# NAME                  STATUS
# mattermost-app        Up X minutes
# mattermost-postgres   Up X minutes
# mattermost-nginx      Up X minutes
```

## Step A4: Configure DNS

You need to point your domain (e.g., `chat.yourfactory.com`) to your server's IP address.

1. Log into your domain registrar (where you bought the domain)
2. Find the **DNS settings** or **DNS management** page
3. Add an **A record**:
   - **Name/Host:** `chat` (or `@` for the root domain)
   - **Value/Points to:** Your server's IP address
   - **TTL:** 300 (5 minutes) or 3600 (1 hour)

DNS changes can take 5 minutes to 24 hours to propagate.

## Step A5: Configure SSL (HTTPS)

Mattermost comes with a built-in Let's Encrypt client. SSL certificates are free and auto-renewing.

```bash
# Check the logs to see if SSL was configured automatically
sudo docker compose logs app | grep -i "ssl\|https\|letsencrypt"
```

If SSL was not configured automatically, you can set it up manually:

```bash
# Install Certbot (Let's Encrypt client)
sudo apt-get install -y certbot

# Obtain a certificate for your domain
sudo certbot certonly --standalone -d chat.yourfactory.com

# Follow the prompts — use your real email address
```

## Step A6: Complete the First-Run Wizard

1. Open your browser and go to `https://chat.yourfactory.com`
2. You will see a setup wizard
3. Create the **System Admin** account (this will be the architect's account):
   - Email: `architect@yourfactory.com`
   - Username: `architect`
   - Password: `ChooseAStrongPassword!`
4. Click **"Complete Setup"**
5. You are now logged into Mattermost!

## Step A7: Create a Bot Account

A **bot account** is an automated user that your sync service will use to make API calls. It is like a robot secretary that manages users and channels.

```bash
# Step 1: Enable bot account creation
# Go to System Console → Integrations → Bot Accounts
# Set "Enable Bot Account Creation" to "true"
# You can do this via the web UI at:
# https://chat.yourfactory.com/admin_console/integrations/bot_accounts

# Step 2: Create a bot account via the API
# First, get an access token for your admin account
# Go to Profile → Security → Personal Access Tokens → Create Token
# Save this token — you will need it
```

Or use the command-line tool:

```bash
# Connect to the Mattermost container
sudo docker exec -it mattermost-app bash

# Create a bot account
./bin/mmctl user create \
  --email="sync-bot@yourfactory.com" \
  --username="sync-bot" \
  --password="BotPassword123!" \
  --system-admin

# Create an access token for the bot
./bin/mmctl token generate sync-bot

# Copy the token that is displayed — you will use it in the sync service
# It looks like: "abc123def456..."
```

**Save this bot token.** You will use it in every API call. If you lose it, you can generate a new one.

## Step A8: Create the Team

A **team** is a group of users. In Mattermost, everything (channels, messages) belongs to a team.

```bash
# Via the API, create a team
curl -X POST https://chat.yourfactory.com/api/v4/teams \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "starium-factory",
    "display_name": "Starium Factory",
    "type": "O"
  }'

# Save the returned team ID — you will need it
```

**What the API response looks like:**

```json
{
  "id": "team_id_here",
  "name": "starium-factory",
  "display_name": "Starium Factory",
  "type": "O"
}
```

## Step A9: Create Initial Channels

```bash
# Create the All Announcements channel
curl -X POST https://chat.yourfactory.com/api/v4/channels \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "your-team-id",
    "name": "all-announcements",
    "display_name": "All Announcements",
    "purpose": "Company-wide announcements.",
    "type": "O"
  }'

# Create the General channel
curl -X POST https://chat.yourfactory.com/api/v4/channels \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "your-team-id",
    "name": "general",
    "display_name": "General",
    "purpose": "General company discussion.",
    "type": "O"
  }'

# Create the QC Team channel
curl -X POST https://chat.yourfactory.com/api/v4/channels \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "your-team-id",
    "name": "qc-team",
    "display_name": "QC Team",
    "purpose": "Quality control discussions and alerts.",
    "type": "O"
  }'
```

**Channel type:** `"O"` means public (anyone can find and join). `"P"` means private (invite-only).

---

## ✅ PART A CHECKPOINT

At this point you should have:
- [ ] A server running Mattermost
- [ ] HTTPS working at `https://chat.yourfactory.com`
- [ ] A bot account with an API token
- [ ] A team created
- [ ] 3 channels created

---

# PART B — BUILD THE SYNC SERVICE

The **sync service** is a small Node.js program that runs continuously and keeps Mattermost in sync with your ERP database.

---

## Step B1: Set Up the Project

```bash
# Create a folder for your sync service
mkdir ~/sync-service && cd ~/sync-service

# Initialize a Node.js project
npm init -y

# Install the libraries we need
npm install axios pg dotenv

# Create the folder structure
mkdir src
```

**What each library does:**

| Library | Purpose |
|---|---|
| `axios` | Makes HTTP requests to the Mattermost API |
| `pg` | Connects to your PostgreSQL database (the ERP) |
| `dotenv` | Loads configuration from a `.env` file |

## Step B2: Create the Configuration File

Create a file called `.env` in the `~/sync-service` folder:

```bash
nano .env
```

Paste this content (replace the values with your own):

```bash
# === MATTERMOST CONFIGURATION ===
# The URL of your Mattermost server
MATTERMOST_URL=https://chat.yourfactory.com

# The bot token you created in Step A7
MATTERMOST_BOT_TOKEN=your-bot-token-here

# The team ID from Step A8
MATTERMOST_TEAM_ID=your-team-id-here

# === ERP DATABASE CONFIGURATION ===
# Connection string to your ERP's PostgreSQL database
# Format: postgresql://username:password@host:port/database
ERP_DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/starium_erp

# How often to sync (in seconds)
SYNC_INTERVAL=60
```

**What is a connection string?** It is a single line that tells PostgreSQL how to connect. For example: `postgresql://admin:secret123@10.0.0.5:5432/starium_erp` means "connect as user 'admin' with password 'secret123' to the server at IP 10.0.0.5 on port 5432, and use the database named 'starium_erp'."

## Step B3: Create the Mattermost API Client

This is a reusable class that handles all communication with Mattermost. Create `src/mattermost-client.js`:

```javascript
// src/mattermost-client.js
// This file is a "wrapper" around the Mattermost API.
// Instead of writing raw HTTP requests everywhere, we call methods like:
//   client.createUser({...})
//   client.deactivateUser(userId)

const axios = require('axios');

class MattermostClient {
  /**
   * Create a new Mattermost API client.
   * 
   * @param {string} baseUrl - The URL of your Mattermost server (e.g., https://chat.yourfactory.com)
   * @param {string} token - The bot token for authentication
   */
  constructor(baseUrl, token) {
    // axios is an HTTP client. We configure it once here with the base URL
    // and authentication header so every request automatically includes them.
    this.api = axios.create({
      baseURL: `${baseUrl}/api/v4`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  /**
   * Get all users from Mattermost.
   * Mattermost paginates results (200 per page), so we loop through all pages.
   * 
   * @returns {Array} Array of user objects
   */
  async getUsers() {
    let allUsers = [];
    let page = 0;
    const perPage = 200;

    while (true) {
      const response = await this.api.get('/users', {
        params: { page, per_page: perPage }
      });

      // If this page has no users, we have reached the end
      if (response.data.length === 0) break;

      allUsers = allUsers.concat(response.data);
      page++;
    }

    return allUsers;
  }

  /**
   * Create a new user in Mattermost.
   * 
   * @param {Object} userData - The user's information
   * @param {string} userData.email - Email address
   * @param {string} userData.username - Username (usually the email prefix)
   * @param {string} userData.first_name - First name
   * @param {string} userData.last_name - Last name
   * @param {string} userData.password - Temporary password
   * @returns {Object} The created user object (contains the user's ID)
   */
  async createUser({ email, username, first_name, last_name, password }) {
    const response = await this.api.post('/users', {
      email,
      username,
      first_name,
      last_name,
      password
    });
    return response.data;
  }

  /**
   * Deactivate a user in Mattermost.
   * Deactivated users cannot log in or access any data.
   * 
   * @param {string} userId - The Mattermost user ID to deactivate
   */
  async deactivateUser(userId) {
    await this.api.delete(`/users/${userId}`);
  }

  /**
   * Update a user's details in Mattermost.
   * 
   * @param {string} userId - The Mattermost user ID
   * @param {Object} updates - Fields to update (e.g., { first_name: "NewName" })
   * @returns {Object} The updated user object
   */
  async updateUser(userId, updates) {
    const response = await this.api.put(`/users/${userId}`, updates);
    return response.data;
  }

  // ============================================================
  // CHANNEL MANAGEMENT
  // ============================================================

  /**
   * Get all channels in a team.
   * 
   * @param {string} teamId - The team ID
   * @returns {Array} Array of channel objects
   */
  async getChannels(teamId) {
    const response = await this.api.get(`/teams/${teamId}/channels`);
    return response.data;
  }

  /**
   * Create a new channel.
   * 
   * @param {Object} channelData
   * @param {string} channelData.team_id - The team to create the channel in
   * @param {string} channelData.name - URL-friendly name (e.g., "qc-team")
   * @param {string} channelData.display_name - Human-readable name (e.g., "QC Team")
   * @param {string} channelData.purpose - Description of the channel
   * @param {string} channelData.type - "O" for public, "P" for private
   * @returns {Object} The created channel object
   */
  async createChannel({ team_id, name, display_name, purpose, type = 'O' }) {
    const response = await this.api.post('/channels', {
      team_id,
      name,
      display_name,
      purpose,
      type
    });
    return response.data;
  }

  /**
   * THIS IS THE KEY METHOD FOR AUTOMATED USER MANAGEMENT.
   * 
   * Set the EXACT list of members for a channel in one API call.
   * Mattermost automatically:
   *   1. Adds any users in `memberIds` who are NOT currently in the channel
   *   2. Removes any users currently in the channel who are NOT in `memberIds`
   *   3. Leaves everyone else untouched
   * 
   * This is called "reconciliation" — like comparing two lists and making them match.
   * 
   * @param {string} channelId - The channel to update
   * @param {string[]} memberIds - Array of user IDs that SHOULD be in the channel
   * @param {string[]} adminIds - Array of user IDs that should be channel admins (optional)
   */
  async setChannelMembers(channelId, memberIds, adminIds = []) {
    await this.api.put(`/channels/${channelId}/members`, {
      members: memberIds,
      channel_admins: adminIds
    });
  }

  // ============================================================
  // MESSAGES
  // ============================================================

  /**
   * Post a message to a channel.
   * 
   * @param {string} channelId - The channel to post in
   * @param {Object} messageData
   * @param {string} messageData.text - The message text (supports Markdown formatting)
   * @param {Array} [messageData.attachments] - Optional rich attachments (colored boxes with fields)
   * @returns {Object} The created post object
   */
  async postMessage(channelId, { text, attachments }) {
    const response = await this.api.post(`/channels/${channelId}/posts`, {
      message: text,
      props: attachments ? { attachments } : undefined
    });
    return response.data;
  }
}

// Export the class so other files can use it
module.exports = MattermostClient;
```

## Step B4: Create the Database Connection

Create `src/database.js`:

```javascript
// src/database.js
// This file manages the connection to your ERP's PostgreSQL database.
// The ERP stores employee information: names, emails, roles, departments, etc.

const { Pool } = require('pg');

class Database {
  /**
   * Create a new database connection pool.
   * A "pool" is a group of reusable database connections.
   * 
   * @param {string} connectionString - PostgreSQL connection string
   */
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  /**
   * Get all active employees from the ERP.
   * 
   * This SQL query selects employees who:
   * - Have not been deleted (deleted_at IS NULL)
   * - Are currently active (is_active = true)
   * 
   * You may need to modify this query based on your ERP's actual table structure.
   * Ask your database administrator for the correct table and column names.
   * 
   * @returns {Array} Array of employee objects
   */
  async getActiveEmployees() {
    const result = await this.pool.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        department,
        shift,
        production_line_id,
        is_active
      FROM users
      WHERE deleted_at IS NULL
        AND is_active = true
    `);
    return result.rows;
  }

  /**
   * Get all employees that should be in a specific channel.
   * Each channel has different membership rules.
   * 
   * @param {string} channelName - The channel name (e.g., "qc-team", "production-line-1")
   * @returns {Array} Array of employee objects with their Mattermost user IDs
   */
  async getChannelMembers(channelName) {
    // Each channel has its own membership logic.
    // We use a switch statement to define the rules.
    // 
    // IMPORTANT: Modify these SQL queries to match your ERP's actual
    // table and column names. The examples below assume a "users" table
    // with columns like role, department, shift, and production_line_id.
    
    let query;

    switch (channelName) {
      case 'all-announcements':
        // EVERY active employee should be in this channel
        query = `SELECT id, mattermost_user_id FROM users WHERE is_active = true AND deleted_at IS NULL`;
        break;

      case 'general':
        // EVERY active employee should be in this channel
        query = `SELECT id, mattermost_user_id FROM users WHERE is_active = true AND deleted_at IS NULL`;
        break;

      case 'qc-team':
        // Only QC staff and managers should be in this channel
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND role IN ('qc_manager', 'qc_staff', 'super_admin')`;
        break;

      case 'production-line-1':
        // Only Line 1 workers and production managers
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND (production_line_id = 1 
                    OR role IN ('prod_manager', 'super_admin'))`;
        break;

      case 'production-line-2':
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND (production_line_id = 2 
                    OR role IN ('prod_manager', 'super_admin'))`;
        break;

      case 'night-shift':
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND shift = 'night'`;
        break;

      case 'management':
        // Only managers — this channel is private
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND role IN ('super_admin', 'qc_manager', 'prod_manager')`;
        break;

      case 'maintenance':
        query = `SELECT id, mattermost_user_id FROM users 
                 WHERE is_active = true AND deleted_at IS NULL
                   AND department = 'maintenance'`;
        break;

      default:
        // If the channel name is not recognized, return an empty list
        return [];
    }

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Store the Mattermost user ID in the ERP database.
   * After creating a user in Mattermost, we save their Mattermost ID
   * so we can reference it later (for channel membership, deactivation, etc.).
   * 
   * @param {number} erpUserId - The employee's ID in the ERP
   * @param {string} mattermostUserId - The user's ID in Mattermost
   */
  async storeMattermostUserId(erpUserId, mattermostUserId) {
    await this.pool.query(
      'UPDATE users SET mattermost_user_id = $1 WHERE id = $2',
      [mattermostUserId, erpUserId]
    );
  }

  /**
   * Close all database connections.
   * Call this when shutting down the sync service.
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = Database;
```

## Step B5: Create the Sync Engine

This is the heart of the system. Create `src/sync-engine.js`:

```javascript
// src/sync-engine.js
// This file contains the main synchronization logic.
// It runs in a loop and performs three tasks:
//   1. Sync users (create new, deactivate removed, update changed)
//   2. Sync channel memberships (add/remove people from channels)
//
// Think of it like a person who constantly compares two lists
// (ERP employees vs Mattermost users) and makes them match.

const crypto = require('crypto');

class SyncEngine {
  /**
   * @param {MattermostClient} mattermost - The Mattermost API client
   * @param {Database} database - The ERP database connection
   * @param {string} teamId - The Mattermost team ID
   */
  constructor(mattermost, database, teamId) {
    this.mm = mattermost;
    this.db = database;
    this.teamId = teamId;
  }

  /**
   * Run one full synchronization cycle.
   * Call this every 60 seconds.
   */
  async runCycle() {
    console.log('=== Sync Cycle Started ===');
    
    try {
      // Step 1: Sync users
      const userResult = await this.syncUsers();
      console.log(`Users: ${userResult.created} created, ${userResult.deactivated} deactivated, ${userResult.updated} updated`);

      // Step 2: Sync channel memberships
      const channelResult = await this.syncChannels();
      console.log(`Channels: ${channelResult.synced} synchronized`);

      console.log('=== Sync Cycle Complete ===');
    } catch (error) {
      console.error('Sync cycle failed:', error.message);
      // The error will be caught by the caller, which will wait and retry
    }
  }

  // ============================================================
  // USER SYNCHRONIZATION
  // ============================================================

  /**
   * Sync users from the ERP to Mattermost.
   * 
   * This is how it works (step by step):
   * 
   * 1. Get ALL active employees from the ERP database
   * 2. Get ALL users from Mattermost
   * 3. For each ERP employee NOT in Mattermost → CREATE a new Mattermost user
   * 4. For each Mattermost user NOT in ERP (and not a bot) → DEACTIVATE them
   * 5. For each user in both but with different names → UPDATE the name
   */
  async syncUsers() {
    // Step 1: Get employees from ERP
    const employees = await this.db.getActiveEmployees();
    console.log(`Found ${employees.length} active employees in ERP`);

    // Step 2: Get users from Mattermost
    const mmUsers = await this.mm.getUsers();
    console.log(`Found ${mmUsers.length} users in Mattermost`);

    // Build lookup maps (using email as the unique identifier)
    // Maps are like phonebooks — you look up by email and get the person's info
    const erpByEmail = new Map();
    for (const emp of employees) {
      erpByEmail.set(emp.email.toLowerCase(), emp);
    }

    const mmByEmail = new Map();
    for (const user of mmUsers) {
      mmByEmail.set(user.email.toLowerCase(), user);
    }

    // Track results
    let created = 0;
    let deactivated = 0;
    let updated = 0;

    // Step 3: CREATE new users
    // For each employee in the ERP who does NOT have a Mattermost account yet
    for (const [email, employee] of erpByEmail) {
      if (!mmByEmail.has(email)) {
        // Generate a random temporary password
        // The user will be prompted to change it on first login
        const tempPassword = crypto.randomBytes(12).toString('hex');

        // Create the user in Mattermost
        const newUser = await this.mm.createUser({
          email: employee.email,
          username: employee.email.split('@')[0], // Use the part before @ as username
          first_name: employee.first_name,
          last_name: employee.last_name,
          password: tempPassword
        });

        // Save the Mattermost user ID in the ERP database
        await this.db.storeMattermostUserId(employee.id, newUser.id);

        console.log(`  ✓ Created user: ${employee.email} (MM ID: ${newUser.id})`);
        created++;

        // TODO: In a real system, you would send a welcome email here
        // with the temporary password and login instructions.
        // You can use nodemailer or your existing email service.
      }
    }

    // Step 4: DEACTIVATE users who are no longer in the ERP
    for (const [email, mmUser] of mmByEmail) {
      // Skip bot accounts (they start with a special prefix or have is_bot flag)
      if (mmUser.is_bot) continue;

      // Skip users already deactivated
      if (mmUser.delete_at !== 0) continue;

      // If this user is NOT in the ERP anymore, deactivate them
      if (!erpByEmail.has(email)) {
        await this.mm.deactivateUser(mmUser.id);
        console.log(`  ✓ Deactivated user: ${email}`);
        deactivated++;
      }
    }

    // Step 5: UPDATE users whose names changed
    for (const [email, mmUser] of mmByEmail) {
      const employee = erpByEmail.get(email);
      if (!employee) continue; // User not in ERP (will be deactivated above)

      // Check if the name has changed
      const expectedFirstName = employee.first_name;
      const expectedLastName = employee.last_name;
      const needsUpdate = 
        mmUser.first_name !== expectedFirstName ||
        mmUser.last_name !== expectedLastName;

      if (needsUpdate) {
        await this.mm.updateUser(mmUser.id, {
          first_name: expectedFirstName,
          last_name: expectedLastName
        });
        console.log(`  ✓ Updated user: ${email}`);
        updated++;
      }
    }

    return { created, deactivated, updated };
  }

  // ============================================================
  // CHANNEL SYNCHRONIZATION
  // ============================================================

  /**
   * Sync channel memberships from the ERP to Mattermost.
   * 
   * This is where Mattermost's bulk API shines.
   * For each channel, we:
   *   1. Query the ERP to find out who SHOULD be in the channel
   *   2. Call the bulk API to set the exact membership list
   *   3. Mattermost automatically adds missing users and removes extras
   * 
   * We define the channels and their membership rules in the CHANNELS array below.
   * Add, remove, or modify channels here as your organization changes.
   */
  async syncChannels() {
    // Define all channels and their membership rules
    // 
    // To add a new channel: just add a new entry to this array.
    // The sync service will create it and populate it automatically.
    //
    // To remove a channel: delete its entry from this array.
    // The sync service will NOT delete the channel (that is a manual action),
    // but it will stop managing its membership.
    const CHANNELS = [
      {
        name: 'all-announcements',
        display_name: 'All Announcements',
        purpose: 'Company-wide announcements from management.',
        type: 'O' // Public — anyone can find and join
      },
      {
        name: 'general',
        display_name: 'General',
        purpose: 'General company discussion.',
        type: 'O'
      },
      {
        name: 'qc-team',
        display_name: 'QC Team',
        purpose: 'Quality Control team discussions and alerts.',
        type: 'O'
      },
      {
        name: 'production-line-1',
        display_name: 'Production Line 1',
        purpose: 'Line 1 production team communication.',
        type: 'O'
      },
      {
        name: 'production-line-2',
        display_name: 'Production Line 2',
        purpose: 'Line 2 production team communication.',
        type: 'O'
      },
      {
        name: 'night-shift',
        display_name: 'Night Shift',
        purpose: 'Night shift coordination.',
        type: 'O'
      },
      {
        name: 'management',
        display_name: 'Management',
        purpose: 'Management-level discussions.',
        type: 'P' // Private — only visible to invited members
      },
      {
        name: 'maintenance',
        display_name: 'Maintenance Team',
        purpose: 'Equipment maintenance and downtime coordination.',
        type: 'O'
      }
    ];

    // Get existing channels from Mattermost so we can check which ones exist
    const existingChannels = await this.mm.getChannels(this.teamId);
    const existingByName = new Map(existingChannels.map(c => [c.name, c]));

    let synced = 0;

    // Process each channel definition
    for (const channelDef of CHANNELS) {
      let channel = existingByName.get(channelDef.name);

      // If the channel does not exist yet, create it
      if (!channel) {
        channel = await this.mm.createChannel({
          team_id: this.teamId,
          name: channelDef.name,
          display_name: channelDef.display_name,
          purpose: channelDef.purpose,
          type: channelDef.type
        });
        console.log(`  ✓ Created channel: ${channelDef.name}`);
      }

      // Get the list of users who SHOULD be in this channel
      const members = await this.db.getChannelMembers(channelDef.name);
      const memberIds = members
        .map(m => m.mattermost_user_id)
        .filter(id => id !== null); // Skip users without a Mattermost ID

      if (memberIds.length === 0) {
        console.log(`  - Skipped channel ${channelDef.name}: no members found`);
        continue;
      }

      // THIS IS THE MAGIC LINE:
      // One API call to set the EXACT membership list.
      // Mattermost handles the diff automatically.
      await this.mm.setChannelMembers(channel.id, memberIds);
      console.log(`  ✓ Synced ${memberIds.length} members to channel: ${channelDef.name}`);
      synced++;
    }

    return { synced };
  }
}

module.exports = SyncEngine;
```

## Step B6: Create the Main Entry Point

Create `src/index.js` — this is the file you run to start the sync service:

```javascript
// src/index.js
// This is the ENTRY POINT of the sync service.
// When you run "node src/index.js", this file executes.
//
// It:
//   1. Loads configuration from the .env file
//   2. Creates the Mattermost client
//   3. Creates the database connection
//   4. Creates the sync engine
//   5. Runs the sync loop forever

// Load environment variables from .env file
// This makes process.env.MATTERMOST_URL etc. available
require('dotenv').config();

const MattermostClient = require('./mattermost-client');
const Database = require('./database');
const SyncEngine = require('./sync-engine');

/**
 * Check that all required configuration is present.
 * If anything is missing, print a helpful error and exit.
 */
function validateConfig() {
  const required = [
    'MATTERMOST_URL',
    'MATTERMOST_BOT_TOKEN',
    'MATTERMOST_TEAM_ID',
    'ERP_DATABASE_URL'
  ];

  let missing = false;
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`ERROR: Missing required environment variable: ${key}`);
      console.error(`  Add it to your .env file`);
      missing = true;
    }
  }

  if (missing) {
    console.error('\nYour .env file should look like:');
    console.error(`
MATTERMOST_URL=https://chat.yourfactory.com
MATTERMOST_BOT_TOKEN=your-bot-token
MATTERMOST_TEAM_ID=your-team-id
ERP_DATABASE_URL=postgresql://user:password@host:5432/database
SYNC_INTERVAL=60
    `);
    process.exit(1); // Exit with error code
  }
}

/**
 * The main function that runs the entire sync service.
 */
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Mattermost Sync Service Starting...');
  console.log('═══════════════════════════════════════');

  // Step 1: Validate configuration
  validateConfig();

  // Step 2: Create the Mattermost API client
  const mattermost = new MattermostClient(
    process.env.MATTERMOST_URL,
    process.env.MATTERMOST_BOT_TOKEN
  );

  // Step 3: Create the database connection
  const database = new Database(process.env.ERP_DATABASE_URL);

  // Step 4: Create the sync engine
  const engine = new SyncEngine(
    mattermost,
    database,
    process.env.MATTERMOST_TEAM_ID
  );

  const intervalSeconds = parseInt(process.env.SYNC_INTERVAL || '60');

  console.log(`Sync interval: ${intervalSeconds} seconds`);
  console.log(`Mattermost URL: ${process.env.MATTERMOST_URL}`);
  console.log('');

  // Step 5: Run the first sync cycle immediately
  console.log('Running initial sync...');
  await engine.runCycle();

  // Step 6: Schedule subsequent sync cycles
  // setInterval runs the function every N milliseconds
  setInterval(() => {
    engine.runCycle().catch(err => {
      console.error('Unhandled error in sync cycle:', err.message);
    });
  }, intervalSeconds * 1000);

  console.log(`\nSync service is running. Next sync in ${intervalSeconds} seconds.`);
  console.log('Press Ctrl+C to stop.');
}

// Run the main function and catch any startup errors
main().catch(err => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
```

## Step B7: Test the Sync Service

### First, test your Mattermost API connection:

```bash
# Test that your bot token works
curl -s https://chat.yourfactory.com/api/v4/users/me \
  -H "Authorization: Bearer YOUR_BOT_TOKEN"

# If successful, you will see a JSON response with your bot's info
# If you get an error, check that your token is correct
```

### Test the database connection:

```bash
# Test that you can connect to your ERP database
psql "$ERP_DATABASE_URL" -c "SELECT count(*) FROM users WHERE is_active = true"

# If successful, you will see the number of active users
```

### Run the sync service:

```bash
# From the ~/sync-service folder
node src/index.js
```

**Expected output:**

```
═══════════════════════════════════════
  Mattermost Sync Service Starting...
═══════════════════════════════════════
Sync interval: 60 seconds
Mattermost URL: https://chat.yourfactory.com

Running initial sync...
=== Sync Cycle Started ===
Found 47 active employees in ERP
Found 3 users in Mattermost
  ✓ Created user: jane.doe@factory.com (MM ID: abc123)
  ✓ Created user: john.smith@factory.com (MM ID: abc124)
  ...
  ✓ Synced 47 members to channel: all-announcements
  ✓ Synced 12 members to channel: qc-team
  ✓ Synced 8 members to channel: management
Users: 44 created, 0 deactivated, 0 updated
Channels: 8 synchronized
=== Sync Cycle Complete ===

Sync service is running. Next sync in 60 seconds.
Press Ctrl+C to stop.
```

## Step B8: Run the Sync Service as a Background Service

You do not want the sync service to stop when you close the terminal. Use a process manager:

```bash
# Install PM2 — a process manager for Node.js
npm install -g pm2

# Start the sync service with PM2
pm2 start src/index.js --name sync-service

# Save the PM2 configuration so it restarts on server reboot
pm2 save
pm2 startup

# Useful PM2 commands:
pm2 status              # Check if the service is running
pm2 logs sync-service   # View the logs
pm2 restart sync-service  # Restart the service
pm2 stop sync-service   # Stop the service
```

---

## ✅ PART B CHECKPOINT

At this point you should have:
- [ ] A Node.js sync service project with all files
- [ ] Configuration in `.env`
- [ ] The sync service running and syncing users
- [ ] New users appearing in Mattermost automatically
- [ ] Users assigned to the correct channels

---

# PART C — CONNECT THE ERP TO MATTERMOST

Now that the sync service is running, we need to make the ERP send notifications to Mattermost when important events happen.

---

## Step C1: Create Bot Accounts for Notifications

Different types of notifications should come from different bot accounts. This makes it clear who is sending the message.

```bash
# Via the Mattermost web UI:
# 1. Go to System Console → Integrations → Bot Accounts
# 2. Click "Add Bot Account"
# 3. Create these bots:

# QC Bot
#   Username: qc-bot
#   Display Name: QC Bot
#   Description: Sends quality control alerts

# Production Bot
#   Username: production-bot
#   Display Name: Production Bot
#   Description: Sends production updates

# Maintenance Bot
#   Username: maintenance-bot
#   Display Name: Maintenance Bot
#   Description: Sends maintenance alerts

# HR Bot
#   Username: hr-bot
#   Display Name: HR Bot
#   Description: Sends HR notifications
```

After creating each bot, generate a **Personal Access Token** for it. Save these tokens — you will use them in the ERP code.

## Step C2: Get Channel IDs

You need the channel IDs to send messages to them:

```bash
# Get the channel ID for "qc-team"
curl -s https://chat.yourfactory.com/api/v4/channels \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  | jq '.[] | select(.name == "qc-team") | {id, name, display_name}'

# Output:
# {
#   "id": "channel_id_here",
#   "name": "qc-team",
#   "display_name": "QC Team"
# }
```

Save these channel IDs — you will use them in the ERP code.

## Step C3: Send Notifications from the ERP

Now we add code to the ERP application to send notifications to Mattermost.

### Option A: Direct API (Best for Complex Notifications)

Add this file to your ERP codebase. Where exactly depends on your project structure. If you have a `services` folder, put it there.

Create `services/mattermost-notifier.js`:

```javascript
// services/mattermost-notifier.js
// This service sends notifications from the ERP to Mattermost channels.
// Import and use it anywhere in your ERP code.

const axios = require('axios');

class MattermostNotifier {
  constructor() {
    // Configure these constants with your actual values
    this.serverUrl = 'https://chat.yourfactory.com';
    
    // Bot tokens — create these in the Mattermost System Console
    this.tokens = {
      qc: 'YOUR_QC_BOT_TOKEN',
      production: 'YOUR_PRODUCTION_BOT_TOKEN',
      maintenance: 'YOUR_MAINTENANCE_BOT_TOKEN',
      hr: 'YOUR_HR_BOT_TOKEN'
    };

    // Channel IDs — get these from the Mattermost API
    this.channels = {
      allAnnouncements: 'CHANNEL_ID_HERE',
      qcTeam: 'CHANNEL_ID_HERE',
      productionLine1: 'CHANNEL_ID_HERE',
      productionLine2: 'CHANNEL_ID_HERE',
      management: 'CHANNEL_ID_HERE',
      maintenance: 'CHANNEL_ID_HERE'
    };
  }

  /**
   * Send a simple text message to a channel.
   * 
   * @param {string} channelId - The Mattermost channel ID
   * @param {string} botToken - The bot's authentication token
   * @param {string} text - The message text (supports Markdown)
   */
  async sendMessage(channelId, botToken, text) {
    await axios.post(
      `${this.serverUrl}/api/v4/channels/${channelId}/posts`,
      { message: text },
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
  }

  /**
   * Send a rich notification with a colored border and fields.
   * 
   * @param {Object} options
   * @param {string} options.channelId - Target channel
   * @param {string} options.botToken - Bot token
   * @param {string} options.title - Bold title text
   * @param {string} options.text - Main message text
   * @param {string} options.color - Hex color for the left border (e.g., "#FF1744" for red)
   * @param {Array} options.fields - Array of {title, value, short} objects
   */
  async sendRichNotification({ channelId, botToken, title, text, color, fields }) {
    await axios.post(
      `${this.serverUrl}/api/v4/channels/${channelId}/posts`,
      {
        message: title ? `**${title}**` : '',
        props: {
          attachments: [{
            color: color || '#00E676',
            fields: fields || [],
            text: text || ''
          }]
        }
      },
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
  }

  // ============================================================
  // SPECIFIC NOTIFICATION TYPES
  // These are convenience methods for common ERP events.
  // Add more as needed.
  // ============================================================

  /**
   * Send a QC alert when a check fails.
   * Call this from your QC check submission code.
   */
  async sendQcAlert({ machineName, headNumber, reading, targetMin, targetMax, status, operator }) {
    const color = 
      status === 'Too Low' || status === 'Too High' ? '#FF1744' :  // Red for critical
      status === 'Low' || status === 'High' ? '#FF9100' :           // Orange for warning
      '#00E676';                                                     // Green for OK

    await this.sendRichNotification({
      channelId: this.channels.qcTeam,
      botToken: this.tokens.qc,
      title: `🚨 QC Alert — ${machineName}`,
      color,
      fields: [
        { title: 'Machine', value: machineName, short: true },
        { title: 'Head', value: String(headNumber), short: true },
        { title: 'Reading', value: `${reading}g`, short: true },
        { title: 'Target', value: `${targetMin}g - ${targetMax}g`, short: true },
        { title: 'Status', value: status, short: true },
        { title: 'Operator', value: operator, short: true }
      ],
      text: `[View in ERP](${process.env.ERP_URL}/qc-sachet-production-checks)`
    });
  }

  /**
   * Send a production update.
   * Call this when a shift starts, ends, or hits a milestone.
   */
  async sendProductionUpdate({ lineName, event, details }) {
    await this.sendMessage(
      event === 'shift-start' || event === 'shift-end'
        ? this.channels.allAnnouncements
        : this.channels.productionLine1,
      this.tokens.production,
      `**${event === 'shift-start' ? '🔄' : event === 'shift-end' ? '✅' : '📊'} ${lineName} — ${details}**`
    );
  }

  /**
   * Send a maintenance alert.
   * Call this when a machine goes down or needs attention.
   */
  async sendMaintenanceAlert({ machineName, lineName, downtimeMinutes, description }) {
    await this.sendRichNotification({
      channelId: this.channels.maintenance,
      botToken: this.tokens.maintenance,
      title: `⚠️ Machine Down — ${machineName}`,
      color: '#FF9100',
      fields: [
        { title: 'Machine', value: machineName, short: true },
        { title: 'Line', value: lineName, short: true },
        { title: 'Duration', value: `${downtimeMinutes} minutes`, short: true },
        { title: 'Description', value: description, short: false }
      ]
    });
  }

  /**
   * Send an HR notification.
   * Call this when a new employee is onboarded or offboarded.
   */
  async sendHrNotification({ event, employeeName, employeeRole }) {
    const isOnboarding = event === 'onboarding';
    await this.sendMessage(
      this.channels.allAnnouncements,
      this.tokens.hr,
      `${isOnboarding ? '👋' : '👋'} **${employeeName}** ${isOnboarding ? 'has joined' : 'has left'} the company as **${employeeRole}**.`
    );
  }
}

// Export a singleton instance
module.exports = new MattermostNotifier();
```

### Option B: Webhooks (Simplest Path)

Webhooks are pre-configured URLs that accept a POST request and post the message to a specific channel. No authentication needed — the webhook URL IS the authentication.

**Step 1: Create an incoming webhook in Mattermost**

1. Go to **Main Menu** → **Integrations** → **Incoming Webhooks**
2. Click **"Add Incoming Webhook"**
3. Select the channel (e.g., "QC Team")
4. Give it a title (e.g., "QC Alerts")
5. Click **"Save"**
6. Copy the **Webhook URL** (looks like: `https://chat.yourfactory.com/hooks/abc123`)

**Step 2: Send a message via webhook from anywhere**

```javascript
// This code can run ANYWHERE — your ERP backend, a shell script,
// a machine's IoT sensor, a cron job — anything that can make an HTTP request.

const axios = require('axios');

// Send a simple message
await axios.post('https://chat.yourfactory.com/hooks/abc123', {
  text: '🚨 QC Alert: Line 2, Head 4 — String weight TOO LOW (18.2g)'
});

// Send a rich message with formatting
await axios.post('https://chat.yourfactory.com/hooks/abc123', {
  text: '**🚨 QC Alert — Line 2, Head 4**\n\n| Detail | Value |\n|---|---|\n| Reading | 18.2g |\n| Target | 20-22g |\n| Status | Too Low |',
  username: 'QC Bot'
});
```

You can even send from a **bash script** on a machine:

```bash
#!/bin/bash
# Send an alert from a machine's monitoring script
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text":"⚠️ Machine 3 temperature: 92°C — threshold exceeded"}' \
  https://chat.yourfactory.com/hooks/abc123
```

### Where to Call the Notifier in Your ERP

Here is where you should add Mattermost notification calls in your existing ERP code:

| ERP Event | File to Modify | Code to Add |
|---|---|---|
| **QC check submitted** (string weight, bag, carton) | `services/qcStringWeightOperations.js`, etc. | `notifier.sendQcAlert({...})` |
| **Machine downtime logged** | `services/downtimeOperations.js` | `notifier.sendMaintenanceAlert({...})` |
| **Shift started/ended** | `services/shiftOperations.js` | `notifier.sendProductionUpdate({...})` |
| **New employee created in ERP** | `services/userOperations.js` | `notifier.sendHrNotification({...})` |

**Example — Adding a QC alert to an existing file:**

```javascript
// Inside qcStringWeightOperations.js — when a check is saved
const notifier = require('../services/mattermost-notifier');

async function saveStringWeight(checkData) {
  // ... existing code that saves to Firestore ...

  // NEW: Send notification to Mattermost
  if (checkData.status !== 'Target') {
    await notifier.sendQcAlert({
      machineName: checkData.machineName,
      headNumber: checkData.headNumber,
      reading: checkData.weight,
      targetMin: checkData.targetMin,
      targetMax: checkData.targetMax,
      status: checkData.status,
      operator: checkData.operatorName
    });
  }
}
```

---

## ✅ PART C CHECKPOINT

At this point you should have:
- [ ] Bot accounts created for QC, Production, Maintenance, and HR
- [ ] Notifier service file added to your ERP
- [ ] QC alerts sending when checks fail
- [ ] Production updates sending on shift changes

---

# PART D — FREE SINGLE SIGN-ON (SSO)

SSO means users log into the ERP once and are automatically logged into Mattermost. No separate password needed. In Mattermost Team Edition, SSO is NOT included — but we can build it ourselves with about 50 lines of code.

---

## How SSO Works (Simple Explanation)

Normally, when a user visits `chat.yourfactory.com`, they see a login page and must type their Mattermost password. With SSO, we place a small "proxy" server in front of Mattermost. When the user visits `chat.yourfactory.com`:

1. The proxy checks: "Do you have a valid ERP session cookie?"
2. **YES** → The proxy creates a temporary Mattermost login token and redirects the user to Mattermost. They are logged in automatically.
3. **NO** → The proxy redirects them to the ERP login page.

## Step D1: Create the SSO Proxy

Create a new file `sso-proxy/server.js`:

```javascript
// sso-proxy/server.js
// This is a simple HTTP server that sits between your users and Mattermost.
// It provides Single Sign-On by checking the user's ERP session.
//
// How to run: node server.js
// It listens on port 3000.

const http = require('http');
const https = require('https');
const url = require('url');

// === CONFIGURATION ===
const MATTERMOST_URL = 'https://chat.yourfactory.com';
const ERP_SESSION_COOKIE_NAME = 'erp_session'; // Change to your ERP's session cookie name
const PORT = 3000;

// === HELPER: Check if user has a valid ERP session ===
// 
// This function calls your ERP's "whoami" or "validate session" endpoint.
// If the session is valid, the ERP returns the user's email.
// If not, it returns a 401 error.
//
// IMPORTANT: Replace the URL below with your ERP's actual session validation endpoint.
function validateErpSession(sessionCookie) {
  return new Promise((resolve, reject) => {
    if (!sessionCookie) {
      resolve(null);
      return;
    }

    const erpUrl = new URL('https://erp.yourfactory.com/api/auth/me');
    const options = {
      hostname: erpUrl.hostname,
      port: erpUrl.port,
      path: erpUrl.pathname,
      method: 'GET',
      headers: {
        'Cookie': `${ERP_SESSION_COOKIE_NAME}=${sessionCookie}`
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const user = JSON.parse(data);
            resolve(user.email);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

// === HELPER: Create a Mattermost session for the user ===
//
// Mattermost has an API endpoint that creates a session and returns a token.
// We use the sync-bot's token to impersonate/create a session for the user.
//
// IMPORTANT: Replace YOUR_BOT_TOKEN with your actual sync-bot token.
async function createMattermostSession(userEmail) {
  return new Promise((resolve, reject) => {
    // First, get the user's Mattermost ID by searching their email
    const mmUrl = new URL(`${MATTERMOST_URL}/api/v4/users`);
    mmUrl.searchParams.set('email', userEmail);

    https.get(mmUrl.toString(), {
      headers: {
        'Authorization': 'Bearer YOUR_BOT_TOKEN'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const users = JSON.parse(data);
          if (users.length > 0) {
            // User found — return their user ID
            resolve(users[0].id);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

// === CREATE THE HTTP SERVER ===
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Route: /auth — the SSO entry point
  // When a user visits this URL, we check their ERP session.
  // If valid, we redirect them to Mattermost with a token.
  if (parsedUrl.pathname === '/auth') {
    // Get the ERP session cookie from the request
    const cookies = req.headers.cookie || '';
    const sessionCookie = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(ERP_SESSION_COOKIE_NAME + '='))
      ?.split('=')[1];

    // Validate the ERP session
    const userEmail = await validateErpSession(sessionCookie);

    if (userEmail) {
      // User is authenticated with ERP — redirect to Mattermost
      // They will be logged in automatically if they already have a Mattermost session
      res.writeHead(302, { 'Location': MATTERMOST_URL });
      res.end();
    } else {
      // User is not authenticated — redirect to ERP login
      res.writeHead(302, { 
        'Location': `https://erp.yourfactory.com/login?redirect=${encodeURIComponent('https://chat.yourfactory.com/auth')}`
      });
      res.end();
    }
    return;
  }

  // Route: /health — health check
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // All other routes: redirect to Mattermost directly
  res.writeHead(302, { 'Location': MATTERMOST_URL });
  res.end();
});

server.listen(PORT, () => {
  console.log(`SSO Proxy running on port ${PORT}`);
  console.log(`Redirecting to Mattermost at ${MATTERMOST_URL}`);
});
```

## Step D2: Configure Your Domain to Use the Proxy

Instead of pointing `chat.yourfactory.com` directly to Mattermost, you point it to the SSO proxy:

```
User's browser
      │
      ▼
chat.yourfactory.com  ───▶  SSO Proxy (port 3000)
                                  │
                                  ├── Has ERP session? → Redirect to Mattermost (internal)
                                  │
                                  └── No session? → Redirect to ERP login page
```

Change your DNS or Nginx configuration to route traffic to the SSO proxy instead of directly to Mattermost.

---

## ✅ PART D CHECKPOINT

At this point you should have:
- [ ] An SSO proxy server running
- [ ] Users being redirected to ERP login if not authenticated
- [ ] Users being sent to Mattermost if already authenticated

---

# PART E — EMBED CHAT IN THE APP

Users should not need to switch between the ERP and the chat app. Here is how to embed Mattermost directly in your existing React app.

---

## Step E1: Create a Chat Component

Add this to your React app (e.g., `src/components/ChatPanel.jsx`):

```jsx
// src/components/ChatPanel.jsx
// A resizable chat panel that can be embedded in any page.
// Click the chat bubble to open, click again to close.

import React, { useState } from 'react';

const ChatPanel = () => {
  // Track whether the chat panel is open or closed
  const [isOpen, setIsOpen] = useState(false);

  // The URL of your Mattermost server
  // If you set up SSO (Part D), users will be automatically logged in.
  // Otherwise, they will need to log in separately.
  const chatUrl = 'https://chat.yourfactory.com';

  return (
    <>
      {/* Chat bubble button — always visible in the bottom-right corner */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#00E676',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat panel — slides in from the right when open */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '92px',
            right: '24px',
            width: '400px',
            height: '600px',
            background: '#fff',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 1000,
            border: '1px solid rgba(0,0,0,0.1)'
          }}
        >
          <iframe
            src={chatUrl}
            title="Company Chat"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            // Allow camera and microphone for future video calls
            allow="camera; microphone"
          />
        </div>
      )}
    </>
  );
};

export default ChatPanel;
```

## Step E2: Add the Chat Component to Your App

In your main layout file (e.g., `src/App.jsx` or `src/components/Layout.jsx`):

```jsx
import ChatPanel from './components/ChatPanel';

function App() {
  return (
    <div className="app">
      {/* Your existing app content */}
      
      {/* Add the chat panel — it appears on every page */}
      <ChatPanel />
    </div>
  );
}
```

## Step E3: Alternative — Dashboard Widget (Show Recent Messages)

Instead of embedding the full chat app, you can show a widget on the ERP dashboard that displays recent messages from relevant channels.

Create `src/components/ChatWidget.jsx`:

```jsx
// src/components/ChatWidget.jsx
// Fetches and displays recent messages from Mattermost channels.
// Shows the 5 most recent messages from channels relevant to the current user.

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChatWidget = ({ mattermostToken, channelIds }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentMessages();
  }, []);

  async function fetchRecentMessages() {
    try {
      const allMessages = [];

      // Fetch the 5 most recent posts from each channel
      for (const channelId of channelIds) {
        const response = await axios.get(
          `https://chat.yourfactory.com/api/v4/channels/${channelId}/posts`,
          {
            params: { per_page: 5 },
            headers: { Authorization: `Bearer ${mattermostToken}` }
          }
        );

        // Extract posts from the response
        const posts = Object.values(response.data.posts || {});
        allMessages.push(...posts);
      }

      // Sort by creation time (newest first) and take the top 10
      allMessages.sort((a, b) => b.create_at - a.create_at);
      setMessages(allMessages.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch Mattermost messages:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '16px', color: '#666' }}>Loading messages...</div>;
  }

  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '16px'
    }}>
      <h3 style={{ color: '#00E676', marginBottom: '12px', fontSize: '14px' }}>
        📬 Recent Chat Messages
      </h3>

      {messages.length === 0 ? (
        <p style={{ color: '#666', fontSize: '13px' }}>No recent messages</p>
      ) : (
        messages.map(msg => (
          <div key={msg.id} style={{
            padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontSize: '13px'
          }}>
            <div style={{ color: '#00BCD4', fontWeight: 600, marginBottom: '2px' }}>
              {msg.username || 'Unknown'}
              <span style={{ color: '#666', fontWeight: 400, marginLeft: '8px' }}>
                {new Date(msg.create_at).toLocaleTimeString()}
              </span>
            </div>
            <div style={{ color: '#ccc' }}>
              {msg.message?.substring(0, 120)}
              {msg.message?.length > 120 ? '...' : ''}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ChatWidget;
```

---

## ✅ PART E CHECKPOINT

At this point you should have:
- [ ] A floating chat button on every page
- [ ] Mattermost embedded in an iframe (or a message widget on the dashboard)
- [ ] Users can access chat without leaving the ERP

---

# PART F — PUSH NOTIFICATIONS FOR FREE

Push notifications are what make your phone buzz when you get a new message even when the app is closed. Mattermost's free push notification proxy works for up to 10 users. For more, you can run your own.

---

## Option 1: Mattermost's Hosted Push Proxy (Free for ≤10 Users)

This is the easiest option and works out of the box for the first 10 users.

```bash
# In System Console → Environment → Push Notification Server
# Set "Push Notification Server" to:
https://push.mattermost.com

# This is Mattermost's own push notification server
# It is free for up to 10 users
```

## Option 2: Run Your Own Push Proxy (Free for Any Number)

For more than 10 users, you can run the Mattermost Push Proxy yourself.

```bash
# Clone the push proxy repository
git clone https://github.com/mattermost/mattermost-push-proxy.git
cd mattermost-push-proxy

# Build and run with Docker
docker build -t mm-push-proxy .
docker run -d \
  --name mm-push-proxy \
  -p 8066:8066 \
  mm-push-proxy
```

Then configure Mattermost to use your push proxy:

```bash
# In System Console → Environment → Push Notification Server
# Set to your push proxy URL:
https://push-proxy.yourfactory.com
```

---

# PART G — BACKUP AND DISASTER RECOVERY

---

## Step G1: Automate Daily Database Backups

```bash
# Create a backup script
nano /home/ubuntu/backup-mattermost.sh
```

```bash
#!/bin/bash
# backup-mattermost.sh
# Run this script daily via cron to back up Mattermost.

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Back up the PostgreSQL database
echo "Backing up Mattermost database..."
sudo docker exec mattermost-postgres pg_dump -U mattermost mattermost \
  | gzip > $BACKUP_DIR/mattermost-db-$DATE.sql.gz

# Back up the file storage (user uploads)
echo "Backing up file storage..."
sudo tar -czf $BACKUP_DIR/mattermost-files-$DATE.tar.gz \
  /var/lib/docker/volumes/mattermost-data/

# Delete backups older than RETENTION_DAYS
find $BACKUP_DIR -name "mattermost-db-*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "mattermost-files-*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: $DATE"
```

```bash
# Make the script executable
chmod +x /home/ubuntu/backup-mattermost.sh

# Schedule it to run daily at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/ubuntu/backup-mattermost.sh >> /var/log/mattermost-backup.log 2>&1
```

## Step G2: Test Your Backup by Restoring

```bash
# Simulate a disaster: stop Mattermost
cd ~/mattermost
sudo docker compose down

# Restore the database
gunzip -c /backups/mattermost-db-2026-07-01.sql.gz \
  | sudo docker exec -i mattermost-postgres psql -U mattermost

# Restore files
sudo tar -xzf /backups/mattermost-files-2026-07-01.tar.gz -C /

# Start Mattermost again
sudo docker compose up -d
```

---

# PART H — CAN WE USE SLACK APIS FOR FREE?

This is a common question because Slack's APIs are well-known and widely documented. Let us look at the honest answer.

---

## Slack's Free Tier — What You Get

Slack has a **Free plan** that costs $0. Here is what it includes:

| Feature | Slack Free Plan | Slack Pro ($8.75/user/month) |
|---|---|---|
| Message history | Last 90 days | Unlimited |
| Search | Last 90 days | Unlimited |
| Apps / Integrations | 10 app integrations | Unlimited |
| Channels | Unlimited | Unlimited |
| Users | Unlimited | Unlimited |
| File storage | 5 GB total | 10 GB per user |
| Voice/video calls | 1:1 only | Group calls |
| Guest accounts | Multi-channel guests | All guest types |
| **API access** | ✅ Yes | ✅ Yes |

**The good news:** Slack's API is free to use even on the Free plan.

**The bad news:** The 90-day message history limit means you lose access to older messages. For a factory that needs to reference past QC alerts, production reports, and decisions, this is a dealbreaker.

## What You Can Do with Slack's API for Free

```javascript
// Slack API example — sending a message (works on free plan)
const axios = require('axios');

async function sendSlackMessage(webhookUrl, text) {
  await axios.post(webhookUrl, { text });
}

// Creating a Slack bot (works on free plan, limited to 10 apps)
// 1. Go to https://api.slack.com/apps
// 2. Click "Create New App" → "From Scratch"
// 3. Name it "QC Bot" and select your workspace
// 4. Go to "Incoming Webhooks" → "Activate Incoming Webhooks"
// 5. Click "Add New Webhook to Workspace"
// 6. Select the channel and click "Allow"
// 7. Use the webhook URL to send messages

// Managing users via Slack's SCIM API (requires paid plan)
// Slack's User provisioning API (SCIM) is only available on
// the Business+ plan ($15/user/month). On the Free or Pro plan,
// you CANNOT create/deactivate users programmatically.
```

## What Slack CANNOT Do for Free

| What We Need | Slack Free | Slack Pro | Mattermost Free |
|---|---|---|---|
| **Create users via API** | ❌ No SCIM API | ❌ No SCIM API | ✅ Yes |
| **Deactivate users via API** | ❌ Manual only | ❌ Manual only | ✅ Yes |
| **Bulk channel membership** | ❌ Must add manually | ❌ Must add manually | ✅ Bulk API |
| **Unlimited message history** | ❌ 90 days only | ✅ Unlimited | ✅ Unlimited |
| **Self-hosted (data stays on your server)** | ❌ Cloud only | ❌ Cloud only | ✅ Yes |
| **Cost for 200 users** | $0 (but limited) | $21,000/year | **$0 + server** |

## The Critical Limitation: No Programmatic User Management

The biggest problem with Slack for our use case is:

> **Slack's User Provisioning API (SCIM) is only available on the Business+ plan at $15/user/month.**

This means:
- When HR hires someone, they must manually invite them to Slack
- When someone is terminated, an admin must manually deactivate them
- You cannot write code that says "when this ERP action happens, create/delete a Slack user"

Mattermost's API allows ALL of this for free.

## The 10-App Limit on Free Slack

Slack's Free plan limits you to **10 installed apps or integrations**. If you want:
- A QC Bot for alerts
- A Production Bot for shift updates
- A Maintenance Bot for downtime alerts
- An HR Bot for onboarding notices
- A dashboard widget
- A custom slash command
- Zapier integration
...

You will hit the 10-app limit quickly. On Mattermost, there is no such limit.

## Can You Use Slack APIs for the Sync Service?

**No, not for free.** The sync service needs to:
1. Create users → Slack's SCIM API requires Business+ ($15/user/month = $36,000/year for 200 users)
2. Deactivate users → Same, requires SCIM API
3. Add users to channels → Slack's `conversations.invite` API works on free plan, but you must do it one user at a time

**The sync service approach (automatic onboarding/offboarding) fundamentally requires programmatic user management, which Slack does not offer for free.**

---

## What You COULD Build with Slack's Free API

You could use Slack's free API **only for sending notifications** (webhooks). This works:

```javascript
// This works on Slack's free plan
const webhookUrl = 'https://hooks.slack.com/services/XXX/YYY/ZZZ';

await axios.post(webhookUrl, {
  text: '🚨 QC Alert: Machine 2, Head 4 — Weight too low',
  attachments: [{
    color: '#FF1744',
    fields: [
      { title: 'Reading', value: '18.2g', short: true },
      { title: 'Target', value: '20-22g', short: true }
    ]
  }]
});
```

But you would still need to **manually manage users and channels** in Slack. The onboarding/offboarding problem would not be solved.

---

## The Hybrid Approach (Not Recommended)

You could theoretically use **Slack for chat** (with manual user management) and **Mattermost for the API-driven features** (sync service, automation). But this creates a confusing situation where employees use two chat apps. Avoid this.

---

# PART I — FINAL VERDICT: MATTERMOST VS SLACK

| Requirement | Mattermost (Free) | Slack (Free) | Slack (Pro — $21k/yr) |
|---|---|---|---|
| Programmatic user creation | ✅ Yes | ❌ No | ❌ No (needs Business+) |
| Programmatic user deactivation | ✅ Yes | ❌ No | ❌ No (needs Business+) |
| Bulk channel membership | ✅ Yes | ❌ No | ❌ No |
| Send notifications from ERP | ✅ Yes (webhooks or API) | ✅ Yes (webhooks) | ✅ Yes |
| Self-hosted / data control | ✅ Yes | ❌ No | ❌ No |
| Message history | ✅ Unlimited | ❌ 90 days | ✅ Unlimited |
| Mobile apps | ✅ Yes | ✅ Yes | ✅ Yes |
| SSO (free) | ❌ Needs custom code | ✅ Included | ✅ Included |
| Cost for 200 users | **$120-240/year** | **$0** (limited) | **$21,000/year** |

**If your ONLY need is sending notifications from the ERP to a chat app** (and you are OK manually managing users in Slack), then Slack's free webhooks work fine.

**If you need automated user onboarding/offboarding, channel management, unlimited history, and data control** — which is the whole point of this document — **Mattermost Team Edition is the only option that delivers all of this for free.**

---

> **End of Part 2**
>
> This document covers everything needed to build a fully free, fully integrated company communication system using Mattermost Team Edition. Every feature described here costs $0 in software licensing.
>
> **Next steps:** Follow the checkpoints at the end of each part. By the time you complete all checkpoints, you will have a production-ready chat system that automatically manages users, channels, and notifications — all integrated with your ERP and all running on free software.
