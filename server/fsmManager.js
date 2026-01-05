/**
 * FSM Manager
 * Creates and manages one FSM per instrument with multi-account order callbacks
 */

const { FSM } = require('./fsm');
const multiOrders = require('./multiOrders');

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
    return true;
  }
}

module.exports = new FsmManager(); // Singleton
