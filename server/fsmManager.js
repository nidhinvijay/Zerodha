/**
 * FSM Manager
 * Creates and manages one FSM per instrument with multi-account order callbacks
 */

const { FSM } = require('./fsm');
const multiOrders = require('./multiOrders');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'fsm_state.json');

class FsmManager {
  constructor() {
    this.fsms = new Map(); // token -> FSM instance
    this.signals = new Map(); // token -> signal array
    this.instruments = new Map(); // token -> instrument
  }

  // Initialize FSM for each instrument
  init(instruments) {
    // Initialize multi-account orders module
    multiOrders.init();
    
    for (const inst of instruments) {
      // Store instrument for order placement
      this.instruments.set(inst.token, inst);
      
      // Create FSM with multi-account order callbacks
      const fsm = new FSM(
        inst.zerodha, 
        inst.lot,
        // onLiveBuy - called when live activates (places BUY on ALL accounts)
        () => {
          console.log(`[FsmManager] Live BUY triggered for ${inst.zerodha} - ALL ACCOUNTS`);
          multiOrders.buyAllAccounts(inst).catch(err => console.error('[FsmManager] Multi-buy error:', err));
        },
        // onLiveSell - called when live closes (places SELL on ALL accounts)
        () => {
          console.log(`[FsmManager] Live SELL triggered for ${inst.zerodha} - ALL ACCOUNTS`);
          multiOrders.sellAllAccounts(inst).catch(err => console.error('[FsmManager] Multi-sell error:', err));
        }
      );
      
      this.fsms.set(inst.token, fsm);
      this.signals.set(inst.token, []);
    }

    console.log(`[FsmManager] Initialized ${this.fsms.size} FSMs with multi-account order callbacks`);
    console.log(`[FsmManager] Enabled accounts: ${multiOrders.getEnabledCount()}`);
    
    // Attempt to restore state
    this.loadState();
    
    // Start periodic saving (every 5 seconds)
    setInterval(() => this.saveState(), 5000);
  }

  // Get FSM by token
  getFsm(token) {
    return this.fsms.get(token);
  }

  // Get signals by token
  getSignals(token) {
    return this.signals.get(token) || [];
  }

  // Add signal to instrument
  addSignal(token, signal) {
    const signals = this.signals.get(token);
    if (signals) {
      signals.unshift(signal);
      if (signals.length > 100) signals.pop();
    }
  }

  // Handle tick - route to correct FSM
  handleTick(token, tick) {
    const fsm = this.fsms.get(token);
    if (fsm) {
      return fsm.handleTick(tick);
    }
    return null;
  }

  // Handle signal - route to correct FSM
  handleSignal(token, signal) {
    const fsm = this.fsms.get(token);
    if (fsm) {
      this.addSignal(token, signal);
      return fsm.handleSignal(signal);
    }
    return null;
  }

  // Get snapshot for an instrument
  getSnapshot(token) {
    const fsm = this.fsms.get(token);
    if (fsm) {
      return {
        fsm: fsm.getSnapshot(),
        signals: this.getSignals(token)
      };
    }
    return null;
  }

  // Minute retry for all blocked FSMs
  minuteRetry() {
    const results = [];
    for (const [token, fsm] of this.fsms) {
      if (fsm.minuteRetry()) {
        results.push({ token, fsm: fsm.getSnapshot() });
      }
    }
    return results;
  }

  // Daily reset - clear all FSM states (call at market close)
  dailyReset() {
    console.log('[FsmManager] ═══════════════════════════════════════');
    console.log('[FsmManager] DAILY RESET - Clearing all states');
    console.log('[FsmManager] ═══════════════════════════════════════');
    
    for (const [token, fsm] of this.fsms) {
      fsm.reset();
      this.signals.set(token, []);
    }
    
    console.log(`[FsmManager] Reset ${this.fsms.size} FSMs`);
    this.saveState(); // Save the reset state immediately
    return true;
  }

  // Reset FSMs by exchange (for weekly expiry-based resets)
  resetByExchange(exchanges) {
    console.log('[FsmManager] ═══════════════════════════════════════');
    console.log(`[FsmManager] EXPIRY RESET - Exchanges: ${exchanges.join(', ')}`);
    console.log('[FsmManager] ═══════════════════════════════════════');
    
    let resetCount = 0;
    for (const [token, inst] of this.instruments) {
      if (exchanges.includes(inst.exchange)) {
        const fsm = this.fsms.get(token);
        if (fsm) {
          fsm.reset();
          this.signals.set(token, []);
          resetCount++;
          console.log(`[FsmManager] Reset: ${inst.zerodha} (${inst.exchange})`);
        }
      }
    }
    
    console.log(`[FsmManager] Reset ${resetCount} FSMs for exchanges: ${exchanges.join(', ')}`);
    this.saveState();
    return resetCount;
  }

  // --- Persistence Methods ---

  saveState() {
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        fsms: {},
        signals: {}
      };

      // Serialize FSMs
      for (const [token, fsm] of this.fsms) {
        data.fsms[token] = fsm.serialize();
      }

      // Serialize Signals
      for (const [token, signals] of this.signals) {
        data.signals[token] = signals;
      }

      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
      // console.log('[FsmManager] State saved'); // Too verbose for every 5s
    } catch (err) {
      console.error('[FsmManager] Failed to save state:', err.message);
    }
  }

  loadState() {
    if (!fs.existsSync(STATE_FILE)) {
      console.log('[FsmManager] No saved state found. Starting fresh.');
      return;
    }

    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const data = JSON.parse(raw);
      
      // Note: We no longer reject old state - data persists until expiry-based reset
      console.log(`[FsmManager] Loading saved state from ${data.lastUpdated} (Ongoing/Expiry Mode)...`);
      let loadedCount = 0;

      // Restore FSMs
      if (data.fsms) {
        for (const [tokenStr, fsmData] of Object.entries(data.fsms)) {
          const token = parseInt(tokenStr);
          const fsm = this.fsms.get(token);
          if (fsm) {
            fsm.restore(fsmData);
            loadedCount++;
          }
        }
      }

      // Restore Signals
      if (data.signals) {
        for (const [tokenStr, signals] of Object.entries(data.signals)) {
          const token = parseInt(tokenStr);
          if (this.instruments.has(token)) {
             this.signals.set(token, signals);
          }
        }
      }

      console.log(`[FsmManager] Successfully restored state for ${loadedCount} instruments.`);

    } catch (err) {
      console.error('[FsmManager] Failed to load state:', err.message);
    }
  }
}

module.exports = new FsmManager(); // Singleton
