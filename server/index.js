require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { KiteTicker } = require("kiteconnect");
const { FSM } = require("./fsm");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve Angular build (production)
const angularDist = path.join(__dirname, "../angular/dist/angular/browser");
app.use(express.static(angularDist));

// Single instrument config
const INSTRUMENT = {
  token: 10361602,
  symbol: "NIFTY2610626150CE",
  lot: 65
};

// Initialize FSM
const fsm = new FSM(INSTRUMENT.symbol);

let ticker = null;
let lastTick = null;
let signals = []; // Store last 20 signals

// Parse JSON and text body
app.use(express.json());
app.use(express.text());

// Health check API
app.get("/api/health", (req, res) => res.json({ 
  status: "ok", 
  instrument: INSTRUMENT.symbol,
  fsm: fsm.getSnapshot()
}));

// Parse TradingView text format
function parseSignal(body) {
  if (typeof body === 'object') {
    return {
      symbol: body.symbol || body.sym || INSTRUMENT.symbol,
      intent: body.intent || body.side || "UNKNOWN",
      stoppx: parseFloat(body.stoppx || body.stopPx || body.price) || null
    };
  }
  
  const text = String(body);
  const signal = { symbol: INSTRUMENT.symbol, intent: "UNKNOWN", stoppx: null };
  
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
  const signal = { ...parsed, timestamp: new Date().toISOString() };
  
  console.log("Webhook received:", signal);
  
  // Update FSM with signal
  const fsmState = fsm.handleSignal(signal);
  
  // Store signal (keep last 100)
  signals.unshift(signal);
  if (signals.length > 100) signals.pop();
  
  // Broadcast signal and FSM state
  io.emit("signal", signal);
  io.emit("fsm", fsmState);
  
  res.json({ status: "ok", received: signal, fsm: fsmState });
});

// Serve Angular for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(angularDist, "index.html"));
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  // Send current state on connect
  if (lastTick) socket.emit("tick", lastTick);
  socket.emit("fsm", fsm.getSnapshot());
  socket.emit("signals", signals); // Send signal history
  
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

  ticker = new KiteTicker({ api_key: apiKey, access_token: accessToken });

  ticker.on("connect", () => {
    console.log("KiteTicker connected, subscribing to:", INSTRUMENT.symbol);
    ticker.subscribe([INSTRUMENT.token]);
    ticker.setMode(ticker.modeFull, [INSTRUMENT.token]);
  });

  ticker.on("ticks", (ticks) => {
    if (ticks.length > 0) {
      const t = ticks[0];
      lastTick = {
        symbol: INSTRUMENT.symbol,
        token: t.instrument_token,
        ltp: t.last_price,
        change: t.change,
        volume: t.volume,
        timestamp: new Date().toISOString()
      };
      
      // Update FSM with tick
      const fsmState = fsm.handleTick(lastTick);
      
      // Broadcast tick and FSM state
      io.emit("tick", lastTick);
      io.emit("fsm", fsmState);
    }
  });

  ticker.on("error", (err) => console.error("Ticker error:", err));
  ticker.on("close", () => console.log("Ticker closed"));

  ticker.connect();
  console.log("Connecting to Zerodha...");
}

// Minute boundary check for blocked positions
setInterval(() => {
  const now = new Date();
  if (now.getSeconds() === 0) {
    if (fsm.minuteRetry()) {
      io.emit("fsm", fsm.getSnapshot());
    }
  }
}, 1000);

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startTicker();
});
