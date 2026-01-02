require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { KiteTicker } = require("kiteconnect");

// Modules
const { loadInstruments, findByTradingview, findByToken, getAllTokens } = require("./instruments");
const fsmManager = require("./fsmManager");
const orders = require("./orders");
const history = require("./history");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve Angular build
const angularDist = path.join(__dirname, "../angular/dist/angular/browser");
app.use(express.static(angularDist));

// Load instruments from .env
const instruments = loadInstruments();
fsmManager.init(instruments);

// Track last tick per instrument
const lastTicks = new Map(); // token -> tick

let ticker = null;

// Parse JSON and text body
app.use(express.json());
app.use(express.text());

// API: Get all instruments
app.get("/api/instruments", (req, res) => res.json(instruments));

// API: Health check
app.get("/api/health", (req, res) => res.json({ 
  status: "ok", 
  instrumentCount: instruments.length
}));

// API: Get history dates
app.get("/api/history", (req, res) => res.json(history.getDates()));

// API: Get specific day's data
app.get("/api/history/:date", (req, res) => {
  const day = history.getDay(req.params.date);
  if (day) {
    res.json(day);
  } else {
    res.status(404).json({ error: "Day not found" });
  }
});

// API: Manual save current day
app.post("/api/history/save", (req, res) => {
  const day = history.saveDay(instruments, fsmManager);
  res.json({ saved: true, date: day.date });
});

// Parse TradingView text format
function parseSignal(body) {
  if (typeof body === 'object') {
    return {
      symbol: body.symbol || body.sym,
      intent: body.intent || body.side || "UNKNOWN",
      stoppx: parseFloat(body.stoppx || body.stopPx || body.price) || null
    };
  }
  
  const text = String(body);
  const signal = { symbol: null, intent: "UNKNOWN", stoppx: null };
  
  if (text.includes("Entry")) signal.intent = "BUY";
  else if (text.includes("Exit")) signal.intent = "SELL";
  
  const stopMatch = text.match(/stopPx\s*=\s*([\d.]+)/i);
  if (stopMatch) signal.stoppx = parseFloat(stopMatch[1]);
  
  const symMatch = text.match(/sym\s*=\s*(\S+)/i);
  if (symMatch) signal.symbol = symMatch[1];
  
  return signal;
}

// Webhook endpoint
app.post("/webhook", (req, res) => {
  const parsed = parseSignal(req.body);
  
  // Find instrument by tradingview symbol
  const inst = findByTradingview(instruments, parsed.symbol);
  if (!inst) {
    console.log("Webhook: Unknown symbol:", parsed.symbol);
    return res.status(400).json({ error: "Unknown symbol", symbol: parsed.symbol });
  }
  
  const signal = { 
    ...parsed, 
    token: inst.token,
    zerodha: inst.zerodha,
    timestamp: new Date().toISOString() 
  };
  
  console.log("Webhook received:", signal);
  
  // Update FSM
  const fsmState = fsmManager.handleSignal(inst.token, signal);
  
  // Broadcast to clients watching this instrument
  io.emit("signal", signal);
  io.emit("fsm", { token: inst.token, ...fsmState });
  
  res.json({ status: "ok", received: signal, fsm: fsmState });
});

// Serve Angular for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(angularDist, "index.html"));
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  // Send instruments list
  socket.emit("instruments", instruments);
  
  // Client can request state for an instrument
  socket.on("selectInstrument", (token) => {
    const tick = lastTicks.get(token);
    const snapshot = fsmManager.getSnapshot(token);
    if (tick) socket.emit("tick", tick);
    if (snapshot) {
      socket.emit("fsm", { token, ...snapshot.fsm });
      socket.emit("signals", snapshot.signals);
    }
  });
  
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

// Start KiteTicker
function startTicker() {
  const apiKey = process.env.KITE_API_KEY;
  const accessToken = process.env.KITE_ACCESS_TOKEN;

  if (!apiKey || !accessToken) {
    console.error("Missing KITE_API_KEY or KITE_ACCESS_TOKEN in .env");
    return;
  }

  if (instruments.length === 0) {
    console.warn("No instruments to subscribe");
    return;
  }

  const tokens = getAllTokens(instruments);
  ticker = new KiteTicker({ api_key: apiKey, access_token: accessToken });

  ticker.on("connect", () => {
    console.log("KiteTicker connected, subscribing to", tokens.length, "instruments");
    ticker.subscribe(tokens);
    ticker.setMode(ticker.modeFull, tokens);
  });

  ticker.on("ticks", (ticks) => {
    for (const t of ticks) {
      const inst = findByToken(instruments, t.instrument_token);
      if (!inst) continue;

      const tick = {
        symbol: inst.zerodha,
        token: t.instrument_token,
        ltp: t.last_price,
        change: t.change,
        volume: t.volume,
        timestamp: new Date().toISOString()
      };
      
      lastTicks.set(t.instrument_token, tick);
      
      // Update FSM
      const fsmState = fsmManager.handleTick(t.instrument_token, tick);
      
      // Broadcast tick and FSM
      io.emit("tick", tick);
      if (fsmState) {
        io.emit("fsm", { token: t.instrument_token, ...fsmState });
      }
    }
  });

  ticker.on("error", (err) => console.error("Ticker error:", err));
  ticker.on("close", () => console.log("Ticker closed"));

  ticker.connect();
  console.log("Connecting to Zerodha...");
}

// Minute boundary check for blocked positions + midnight reset
setInterval(() => {
  const now = new Date();
  if (now.getSeconds() === 0) {
    // Minute retry for blocked positions
    const results = fsmManager.minuteRetry();
    for (const { token, fsm } of results) {
      io.emit("fsm", { token, ...fsm });
    }
    
    // Midnight reset (00:00)
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      console.log('[Server] Midnight - saving history and resetting...');
      history.saveDay(instruments, fsmManager);
      fsmManager.dailyReset();
      // Broadcast reset to all clients
      for (const inst of instruments) {
        const snapshot = fsmManager.getSnapshot(inst.token);
        if (snapshot) {
          io.emit("fsm", { token: inst.token, ...snapshot.fsm });
          io.emit("signals", snapshot.signals);
        }
      }
    }
  }
}, 1000);

const PORT = process.env.PORT || 3004;
server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Sync positions on startup
  await orders.syncPositions();
  
  startTicker();
});
