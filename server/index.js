require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { KiteTicker } = require("kiteconnect");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve Angular build (production)
const angularDist = path.join(__dirname, "../angular/dist/angular/browser");
app.use(express.static(angularDist));

// Single instrument config (NIFTY CE option)
const INSTRUMENT = {
  token: 10361602,
  symbol: "NIFTY2610626150CE",
  lot: 65
};

let ticker = null;
let lastTick = null;

// Health check API
app.get("/api/health", (req, res) => res.json({ status: "ok", instrument: INSTRUMENT.symbol }));

// Serve Angular for all other routes (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(angularDist, "index.html"));
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  if (lastTick) socket.emit("tick", lastTick);
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
      io.emit("tick", lastTick);
    }
  });

  ticker.on("error", (err) => console.error("Ticker error:", err));
  ticker.on("close", () => console.log("Ticker closed"));

  ticker.connect();
  console.log("Connecting to Zerodha...");
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startTicker();
});
