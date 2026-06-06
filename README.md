# Niribi 🎙️

An Voice Chat application built with Next.js, LiveKit, and Supabase. 

This guide will walk you through deploying your own instance of "Niribi" on a Linux Virtual Machine (VM).

---

## 🏗️ Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Lucide Icons
- **Real-time WebRTC:** LiveKit (Self-hosted via Docker)
- **Database & Auth:** Supabase (Cloud or Self-hosted)
- **Deployment:** PM2 (for Next.js), Docker Compose (for LiveKit), Caddy (Reverse Proxy & Auto SSL)

---

## 📋 Prerequisites

Before you begin, you will need:
1. **A Linux VM** (Ubuntu 22.04 or 24.04 recommended) with at least 2GB RAM.
2. **Two domains/subdomains** pointing to your VM's public IP address (e.g., `talk.yourdomain.com` for the app, and `livekit.yourdomain.com` for the WebRTC server).
3. **A Supabase Account** (The free tier is perfectly fine).
4. **Basic ports open on your VM Firewall:**
   - HTTP: `80/tcp`
   - HTTPS: `443/tcp`
   - LiveKit API/WebRTC: `7880/tcp`, `7881/tcp`
   - UDP Media Ports: `50000-60000/udp`

---

## 🚀 Deployment Guide

### Step 1: Prepare the VM

SSH into your VM and install the necessary dependencies.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Docker and Docker Compose
sudo apt install -y docker.io docker-compose

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy -y
```

### Step 2: Clone the Repository

Clone this repository to your VM:

```bash
git clone https://github.com/your-username/curious-to-talk.git
cd curious-to-talk
npm install
```

### Step 3: Supabase Setup

1. Create a new project in [Supabase](https://supabase.com/).
2. Run the Supabase SQL files in this order: `supabase/schema.sql`, then `supabase/room_stage.sql`. Apply any other feature migrations used by your deployment afterward.
3. Go to **Project Settings > API** and copy:
   - Your **Project URL**
   - Your **anon / public key** (Make sure to enable Data API access for the tables you need).

### Step 4: Environment Variables

Create a `.env.local` file in the root of the project:

```bash
nano .env.local
```

Paste the following variables and update them with your actual values:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# App Configuration
NEXT_PUBLIC_SITE_URL=https://talk.yourdomain.com
```

### Step 5: Start LiveKit (WebRTC Server)

We use Docker Compose to run LiveKit locally alongside your Next.js app.

1. Navigate to the `livekit` directory:
   ```bash
   cd livekit
   ```
2. Update the `livekit.yaml` config file (make sure the `keys` match your `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`).
3. Start the LiveKit server:
   ```bash
   sudo docker-compose up -d
   ```

### Step 6: Build and Start the Next.js App

Go back to the root of your project, build the app, and start it using PM2 so it stays alive.

```bash
cd ..
npm run build
pm2 start npm --name "curious-to-talk" -- run start
pm2 save
pm2 startup
```

### Step 7: Configure Caddy (Reverse Proxy & HTTPS)

Caddy makes it extremely easy to route traffic to both the App and the LiveKit server while automatically provisioning free Let's Encrypt SSL certificates.

Open the Caddy configuration file:
```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with:

```caddyfile
talk.yourdomain.com {
    reverse_proxy localhost:3000
}

livekit.yourdomain.com {
    reverse_proxy localhost:7880
}
```

Restart Caddy to apply the changes:
```bash
sudo systemctl restart caddy
```

---

## 🎉 You're Done!

Your application should now be live! 
- Access the main application at: **`https://talk.yourdomain.com`**
- Your LiveKit server is securely listening at **`https://livekit.yourdomain.com`**

> **Note on Supabase Free Tier:** If you are using the free tier of Supabase, your project will be paused if it goes 7 days without any API activity. To prevent this, you can set up a simple daily `cron` job on your VM that pings your Supabase REST API endpoint.

---

## 🛠️ Development

If you want to run the app locally for development:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Engineering Documentation

Architecture and implementation decisions are documented in [`docs/`](./docs/README.md). Read the relevant architecture document before changing a feature area, and update it when a change affects state ownership, lifecycle, constraints, or extension patterns.
