require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { KiteTicker } = require("kiteconnect");

// Modules
const { loadInstruments, findByTradingview, findByToken, getAllTokens } = require("./instruments");
const fsmManager = require("./fsmManager");
const orders = require("./orders");
const history = require("./history");
const multiOrders = require("./multiOrders");

const app = express();
app.use(cors()); // Enable CORS for all origins
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

// ============ ACCOUNTS API ============

// API: Get all accounts (without sensitive data)
app.get("/api/accounts", (req, res) => {
  res.json(multiOrders.getAccounts());
});

// API: Add new account
app.post("/api/accounts", (req, res) => {
  try {
    const result = multiOrders.addAccount(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Update account
app.put("/api/accounts/:id", (req, res) => {
  try {
    const result = multiOrders.updateAccount(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Delete account
app.delete("/api/accounts/:id", (req, res) => {
  try {
    const result = multiOrders.deleteAccount(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Reload accounts (after manual edit of accounts.json)
app.post("/api/accounts/reload", (req, res) => {
  const count = multiOrders.reload();
  res.json({ reloaded: true, accountCount: count });
});

// ============ ZERODHA OAUTH CALLBACK ============

/**
 * Zerodha OAuth Callback
 * URL: /zerodha/callback?request_token=XXX&api_key=YYY
 * 
 * Flow:
 * 1. User visits: https://kite.zerodha.com/connect/login?v=3&api_key=XXX
 * 2. User logs in on Zerodha
 * 3. Zerodha redirects here with request_token
 * 4. We find the account by api_key, use its api_secret to generate access_token
 * 5. Save access_token to accounts.json
 * 6. Hot reload (no restart needed!)
 */
app.get('/zerodha/callback', async (req, res) => {
  const requestToken = String(req.query.request_token || '');
  const apiKey = String(req.query.api_key || '');
  
  console.log('[Zerodha Callback] Received:', { requestToken: requestToken ? 'present' : 'missing', apiKey });
  
  if (!requestToken) {
    return res.status(400).send(`
      <html><body style="font-family: Arial; padding: 20px;">
        <h2>❌ Error: Missing request_token</h2>
        <p>Zerodha did not provide a request token.</p>
      </body></html>
    `);
  }
  
  if (!apiKey) {
    return res.status(400).send(`
      <html><body style="font-family: Arial; padding: 20px;">
        <h2>❌ Error: Missing api_key</h2>
        <p>Could not determine which account to update.</p>
      </body></html>
    `);
  }
  
  // Find account by API key
  const account = multiOrders.findByApiKey(apiKey);
  if (!account) {
    return res.status(404).send(`
      <html><body style="font-family: Arial; padding: 20px;">
        <h2>❌ Error: Account not found</h2>
        <p>No account found with API key: ${apiKey}</p>
        <p>Please add this account first via the <a href="/accounts">Accounts page</a>.</p>
      </body></html>
    `);
  }
  
  if (!account.api_secret) {
    return res.status(400).send(`
      <html><body style="font-family: Arial; padding: 20px;">
        <h2>❌ Error: Missing API Secret</h2>
        <p>Account "${account.name}" doesn't have an API secret configured.</p>
        <p>Please update the account with API secret via the <a href="/accounts">Accounts page</a>.</p>
      </body></html>
    `);
  }
  
  try {
    // Generate session using KiteConnect
    const KiteConnect = require('kiteconnect').KiteConnect;
    const kc = new KiteConnect({ api_key: apiKey });
    const response = await kc.generateSession(requestToken, account.api_secret);
    
    const accessToken = String(response.access_token || '');
    if (!accessToken) {
      throw new Error('generateSession returned no access_token');
    }
    
    // Update account with new access token
    multiOrders.updateAccessTokenByApiKey(apiKey, accessToken);
    
    console.log(`[Zerodha Callback] ✅ Token updated for ${account.name}`);
    
    res.status(200).send(`
      <html>
      <head>
        <meta charset="utf-8">
        <title>✅ Token Updated</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: linear-gradient(135deg, #1a1a2e, #16213e); color: #fff; min-height: 100vh; }
          .card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; max-width: 500px; margin: 0 auto; }
          h2 { color: #4caf50; margin-top: 0; }
          .account-name { background: rgba(76,175,80,0.2); padding: 10px 15px; border-radius: 6px; margin: 15px 0; }
          .info { color: #aaa; font-size: 14px; }
          a { color: #64b5f6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Access Token Updated!</h2>
          <div class="account-name">
            <strong>Account:</strong> ${account.name}
          </div>
          <p class="info">Token has been saved and hot-reloaded. No server restart needed!</p>
          <p class="info">Updated at: ${new Date().toLocaleString()}</p>
          <p><a href="/">← Back to Dashboard</a> | <a href="/accounts">Manage Accounts</a></p>
        </div>
      </body>
      </html>
    `);
    
  } catch (err) {
    console.error('[Zerodha Callback] Error:', err.message);
    res.status(500).send(`
      <html><body style="font-family: Arial; padding: 20px; background: #1a1a2e; color: #fff;">
        <h2 style="color: #f44336;">❌ Failed to generate session</h2>
        <p>Account: ${account.name}</p>
        <p>Error: ${err.message}</p>
        <p><a href="/accounts" style="color: #64b5f6;">← Back to Accounts</a></p>
      </body></html>
    `);
  }
});

// API: Get login URLs for all accounts
app.get('/api/accounts/login-urls', (req, res) => {
  const accounts = multiOrders.getAccounts();
  const baseCallbackUrl = `${req.protocol}://${req.get('host')}/zerodha/callback`;
  
  const urls = accounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    loginUrl: acc.hasCredentials ? 
      `https://kite.zerodha.com/connect/login?v=3&api_key=${acc.id.replace('acc_', '')}` : 
      null,
    hasApiKey: acc.hasCredentials
  }));
  
  res.json({ callbackUrl: baseCallbackUrl, accounts: urls });
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

// Start KiteTicker using primary account from accounts.json
function startTicker() {
  // Get primary account credentials
  const primary = multiOrders.getPrimaryAccount();
  
  if (!primary) {
    console.warn("[KiteTicker] No enabled account with credentials found in accounts.json");
    console.warn("[KiteTicker] Add an account via /accounts page and login via Zerodha");
    return;
  }

  if (instruments.length === 0) {
    console.warn("[KiteTicker] No instruments to subscribe");
    return;
  }

  console.log(`[KiteTicker] Using account: ${primary.name}`);

  const tokens = getAllTokens(instruments);
  ticker = new KiteTicker({ api_key: primary.api_key, access_token: primary.access_token });

  ticker.on("connect", () => {
    console.log("[KiteTicker] Connected, subscribing to", tokens.length, "instruments");
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

  ticker.on("error", (err) => console.error("[KiteTicker] Error:", err));
  ticker.on("close", () => console.log("[KiteTicker] Closed"));

  ticker.connect();
  console.log("[KiteTicker] Connecting...");
}

// Reconnect KiteTicker (called after OAuth token update)
function reconnectTicker() {
  console.log("[KiteTicker] Reconnecting with updated credentials...");
  if (ticker) {
    try {
      ticker.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
  // Small delay before reconnect
  setTimeout(() => startTicker(), 1000);
}

// Register reconnect callback
multiOrders.setOnTokenUpdate(reconnectTicker);

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
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startTicker();
});
