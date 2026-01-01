#!/bin/bash
# DigitalOcean Deployment Script
# Run these commands on your DO droplet

# ============================================
# STEP 1: Initial Setup (run once)
# ============================================

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Cloudflare Tunnel (cloudflared)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# Clone repo
cd ~
git clone https://github.com/nidhinvijay/Zerodha.git
cd Zerodha/server

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env  # Edit with your Zerodha credentials

# ============================================
# STEP 2: Run Server (with nohup)
# ============================================

cd ~/Zerodha/server

# Kill any existing process
pkill -f "node index.js" 2>/dev/null

# Run server in background
nohup node index.js > server.log 2>&1 &
echo "Server started! PID: $!"

# View logs
tail -f server.log

# ============================================
# STEP 3: Cloudflare Tunnel (free HTTPS)
# ============================================

# Run tunnel in background (gives you a free URL)
nohup cloudflared tunnel --url http://localhost:3004 > tunnel.log 2>&1 &
echo "Tunnel started! Check tunnel.log for URL"

# Get the public URL
sleep 5
grep -o 'https://[^"]*\.trycloudflare\.com' tunnel.log | head -1

# ============================================
# STEP 4: Pull Updates & Restart
# ============================================

cd ~/Zerodha
git pull origin main

cd server
npm install

# Restart server
pkill -f "node index.js"
nohup node index.js > server.log 2>&1 &

# Restart tunnel (if needed)
pkill -f cloudflared
nohup cloudflared tunnel --url http://localhost:3001 > tunnel.log 2>&1 &

# ============================================
# USEFUL COMMANDS
# ============================================

# Check if server is running
# ps aux | grep "node index.js"

# View server logs
# tail -f ~/Zerodha/server/server.log

# View tunnel logs (to get URL)
# cat ~/Zerodha/server/tunnel.log

# Kill everything
# pkill -f "node index.js" && pkill -f cloudflared
