/**
 * FSM Manager
 * Creates and manages one FSM per instrument
 */

const { FSM } = require('./fsm');

class FsmManager {
  constructor() {
    this.fsms = new Map(); // token -> FSM instance
    this.signals = new Map(); // token -> signal array
  }

  // Initialize FSM for each instrument
  init(instruments) {
    for (const inst of instruments) {
      this.fsms.set(inst.token, new FSM(inst.zerodha, inst.lot));
      this.signals.set(inst.token, []);
    }
    console.log(`[FsmManager] Initialized ${this.fsms.size} FSMs`);
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
