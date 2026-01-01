/**
 * FSM Manager
 * Creates and manages one FSM per instrument with live order callbacks
 */

const { FSM } = require('./fsm');
const orders = require('./orders');

class FsmManager {
  constructor() {
    this.fsms = new Map(); // token -> FSM instance
    this.signals = new Map(); // token -> signal array
    this.instruments = new Map(); // token -> instrument
  }

  // Initialize FSM for each instrument
  init(instruments) {
    // Initialize orders module
    orders.init();
    
    for (const inst of instruments) {
      // Store instrument for order placement
      this.instruments.set(inst.token, inst);
      
      // Create FSM with order callbacks
      const fsm = new FSM(
        inst.zerodha, 
        inst.lot,
        // onLiveBuy - called when live activates
        () => {
          console.log(`[FsmManager] Live BUY triggered for ${inst.zerodha}`);
          orders.buyOrder(inst).catch(err => console.error('[FsmManager] Buy order error:', err));
        },
        // onLiveSell - called when live closes
        () => {
          console.log(`[FsmManager] Live SELL triggered for ${inst.zerodha}`);
          orders.sellOrder(inst).catch(err => console.error('[FsmManager] Sell order error:', err));
        }
      );
      
      this.fsms.set(inst.token, fsm);
      this.signals.set(inst.token, []);
    }
    console.log(`[FsmManager] Initialized ${this.fsms.size} FSMs with order callbacks`);
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
}

module.exports = new FsmManager(); // Singleton
