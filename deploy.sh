#!/bin/bash
# DigitalOcean Deployment Script (PM2 version)

# ============================================
# STEP 1: Initial Setup (run once)
# ============================================

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Cloudflare Tunnel
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# Clone repo
cd ~
git clone https://github.com/nidhinvijay/Zerodha.git

# Setup server
cd ~/Zerodha/server
npm install
cp .env.example .env
nano .env  # Edit with your Zerodha credentials

# Build Angular
cd ~/Zerodha/angular
npm install
npm run build

# ============================================
# STEP 2: Run Server with PM2
# ============================================

cd ~/Zerodha/server
pm2 start index.js --name "zerodha"
pm2 save
pm2 startup  # Auto-start on reboot

# ============================================
# STEP 3: Cloudflare Tunnel (free HTTPS)
# ============================================

# Run tunnel with PM2
pm2 start "cloudflared tunnel --url http://localhost:3004" --name "tunnel"
pm2 save

# Get the public URL
sleep 5 && pm2 logs tunnel --lines 20 | grep -o 'https://[^"]*\.trycloudflare\.com'

# ============================================
# STEP 4: Pull Updates & Restart
# ============================================

cd ~/Zerodha
git pull origin main

# Rebuild Angular
cd angular && npm install && npm run build

# Restart server
cd ../server && npm install
pm2 restart zerodha

# ============================================
# USEFUL PM2 COMMANDS
# ============================================

# pm2 list              # Show all processes
# pm2 logs zerodha      # View server logs
# pm2 logs tunnel       # View tunnel logs (for URL)
# pm2 restart zerodha   # Restart server
# pm2 stop zerodha      # Stop server
# pm2 delete all        # Remove all processes
# pm2 monit             # Live dashboard

# ============================================
# ACCESS
# ============================================
# Dashboard: https://xxx.trycloudflare.com (from tunnel logs)
# API Health: https://xxx.trycloudflare.com/api/health
