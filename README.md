# 🚀 Zerodha Algorithmic Trading System: End-to-End Workflow

This document outlines the complete lifecycle of a trade interaction, mapping every step to the specific **files** and **functions** responsible.

## 🏗️ Technical Architecture
*   **Server**: Node.js + Socket.IO (`/server`)
*   **Frontend**: Angular 19 (`/angular`)
*   **Database**: JSON Files (`accounts.json`, `fsm_state.json`) for portability.

---

## 🌊 1. Signal Injection (TradingView -> Server)

**Goal**: receive webhook and route to the correct instrument.

*   **File**: `server/index.js`
*   **Function**: `app.post('/webhook')`

**Step-by-Step Code Flow**:
1.  **Receive**: Webhook hits `/webhook` endpoint.
2.  **Parse**: `parseSignal(req.body)` extracts:
    *   `symbol` (e.g., "NIFTY260106C26150")
    *   `intent` ("BUY"/"SELL")
    *   `stoppx` (Stop Price for threshold)
3.  **Lookup**: `findByTradingview()` (in `instruments.js`) finds the internal Zerodha `token` (e.g., `10361602`).
4.  **Route**: Calls `fsmManager.handleSignal(token, signal)` to pass data to the logic layer.

---

## 🧠 2. The Logic Core (FSM Manager)

**Goal**: Decide if we should enter a trade based on the new signal and current price.

*   **File**: `server/fsmManager.js` & `server/fsm.js`

**Step-by-Step Code Flow**:
1.  **Manager**: `fsmManager.js` keeps a Map of all instruments. It finds the specific `FSM` instance for that token.
2.  **State Update**: `fsm.handleSignal(signal)` is called.
    *   Sets `this.threshold = signal.stoppx`.
    *   Sets `this.state = 'NOPOSITION_SIGNAL'`.
3.  **Live Price Stream**:
    *   `server/index.js` receives ticks via `ticker.on('ticks')`.
    *   Calls `fsmManager.handleTick(token, tick)`.
    *   Calls `fsm.handleTick(tick)`.
4.  **Evaluation**: Inside `fsm.evaluate()`:
    *   Checks: `if (this.ltp > this.threshold)`
    *   If True: Transition to `BUYPOSITION`.

---

## 📝 3. Paper Trading (Validation)

**Goal**: Track virtual profit to validate strategy before betting real money.

*   **File**: `server/fsm.js`

**Logic**:
1.  **Entry**: On transition to `BUYPOSITION`, sets `this.entryPrice = this.ltp`.
2.  **PnL Calc**: `getUnrealizedPnL()` runs on every tick.
    *   `(currentLTP - entryPrice) * lotSize`
3.  **Accumulation**: `this.cumPnL` tracks the total profit of all paper trades.

---

## 💸 4. Live Execution (Real Money)

**Goal**: Place actual orders on Zerodha accounts.

*   **File**: `server/multiOrders.js`
*   **Data Source**: `server/accounts.json` (Stores API Key, Secret, Access Token for all users)

**Trigger Sequence**:
1.  **The Switch**: In `fsm.checkLiveActivation()`:
    *   Condition: `if (this.cumPnL > 0)`
    *   Action: `this.liveActive = true` and call `this.onLiveBuy()`.
2.  **The Routing**:
    *   `onLiveBuy` (passed from `fsmManager.js`) calls `multiOrders.buyAllAccounts(instrument)`.
3.  **The Execution**:
    *   **Function**: `placeOrderOnAccount()` loops through `accounts.json`.
    *   **Filter**: Checks `account.enabled === true`.
    *   **Calculation**: Calculates dynamic quantity based on `CAPITAL` constant.
    *   **API Call**: `kite.placeOrder()` sends `MARKET` order to Zerodha.

---

## 🔐 5. Credentials & Security

Unlike typical apps, we do **not** use separate `.env` variables for different accounts.

*   **File**: `server/accounts.json`
*   **Structure**: Array of account objects.
    ```json
    [
      {
        "name": "User1",
        "api_key": "xxx",
        "access_token": "yyy",
        "enabled": true
      }
    ]
    ```
*   **Management**:
    *   Managed via the `/accounts` UI page.
    *   **Hot Reloading**: `multiOrders.reload()` refreshes credentials without restarting the server.
    *   **Ticker Connection**: `getPrimaryAccount()` selects the first active account to power the market data feed (`KiteTicker`).

---

## ☁️ 6. Production Deployment

*   **Process Manager**: `PM2`.
    *   Keeps `index.js` running.
    *   Code: `pm2 start index.js --name zerodha`
*   **Tunneling**: Cloudflare Tunnel.
    *   Exposes `localhost:3004` safely to `https://your-domain.com`.
    *   No open inbound ports on the server firewall.
