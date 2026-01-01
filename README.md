# Zerodha Tick Dashboard

Minimal real-time tick dashboard for Zerodha options.

## Structure
```
├── server/          # Node.js + Socket.IO server
│   ├── index.js     # KiteTicker connection + broadcasting
│   └── .env         # Your Zerodha credentials (create from .env.example)
│
└── angular/         # Angular 19 frontend
    └── src/app/
        ├── app.component.ts   # Dashboard UI
        └── tick.service.ts    # Socket.IO client
```

## Setup

### 1. Server
```bash
cd server
cp .env.example .env
# Edit .env with your KITE_API_KEY and KITE_ACCESS_TOKEN
npm install
npm start
```

### 2. Angular
```bash
cd angular
npm install
npm start
```

### 3. Open
- Angular: http://localhost:4200
- Server: http://localhost:3001

## Phase 1 Features
- ✅ Single instrument tick display
- ✅ Real-time LTP, change %, volume
- ✅ Socket.IO streaming
