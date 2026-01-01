/**
 * FSM (Finite State Machine) for trading
 * States: NOSIGNAL → NOPOSITION_SIGNAL → BUYPOSITION or NOPOSITION_BLOCKED
 */

const STATES = {
  NOSIGNAL: 'NOSIGNAL',
  NOPOSITION_SIGNAL: 'NOPOSITION_SIGNAL',
  BUYPOSITION: 'BUYPOSITION',
  NOPOSITION_BLOCKED: 'NOPOSITION_BLOCKED'
};

class FSM {
  constructor(symbol) {
    this.symbol = symbol;
    this.state = STATES.NOSIGNAL;
    this.threshold = null;
    this.ltp = null;
    this.blockedAtMs = null;
    this.lastCheckedAtMs = null;
    this.entryPrice = null;
    
    // State change log (keeps last 50)
    this.stateLog = [];
  }

  // Log state change with timestamp
  logStateChange(event, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      state: this.state,
      ltp: this.ltp,
      threshold: this.threshold,
      ...details
    };
    this.stateLog.unshift(entry);
    if (this.stateLog.length > 50) this.stateLog.pop();
    console.log(`[FSM] ${event}: state=${this.state}, ltp=${this.ltp}, threshold=${this.threshold}`);
  }

  // Handle incoming signal
  handleSignal(signal) {
    console.log(`[FSM] handleSignal called:`, signal);
    
    if (signal.intent === 'BUY' && signal.stoppx) {
      this.threshold = signal.stoppx;
      const prevState = this.state;
      this.state = STATES.NOPOSITION_SIGNAL;
      this.blockedAtMs = null;
      this.logStateChange('BUY_SIGNAL', { prevState, stoppx: signal.stoppx });
      
      // Immediately evaluate if we have LTP
      if (this.ltp !== null) {
        this.evaluate('SIGNAL_EVAL');
      }
    } else if (signal.intent === 'SELL') {
      const prevState = this.state;
      const wasInPosition = this.state === STATES.BUYPOSITION;
      this.state = STATES.NOSIGNAL;
      this.threshold = null;
      this.blockedAtMs = null;
      this.entryPrice = null;
      // Log only once
      this.logStateChange(wasInPosition ? 'SELL_EXIT' : 'SELL_SIGNAL', { prevState, exitPrice: wasInPosition ? this.ltp : null });
    }
    return this.getSnapshot();
  }

  // Handle incoming tick
  handleTick(tick) {
    this.ltp = tick.ltp;
    this.symbol = tick.symbol;
    
    // Only evaluate if we have a signal
    if (this.state !== STATES.NOSIGNAL) {
      this.evaluate('TICK');
    }
    return this.getSnapshot();
  }

  // Evaluate state based on current LTP and threshold
  evaluate(trigger = 'UNKNOWN') {
    if (this.state === STATES.NOSIGNAL) return;
    if (this.ltp === null || this.threshold === null) return;

    const prevState = this.state;

    if (this.ltp > this.threshold) {
      // Entry condition met
      if (this.state !== STATES.BUYPOSITION) {
        this.state = STATES.BUYPOSITION;
        this.entryPrice = this.ltp;
        this.blockedAtMs = null;
        this.logStateChange('ENTRY', { trigger, prevState, entryPrice: this.entryPrice });
      }
    } else {
      // Below threshold
      if (this.state === STATES.BUYPOSITION) {
        // Stop loss triggered
        this.logStateChange('STOP_LOSS', { trigger, prevState, exitPrice: this.ltp });
        this.state = STATES.NOSIGNAL;
        this.threshold = null;
        this.entryPrice = null;
      } else if (this.state === STATES.NOPOSITION_SIGNAL || this.state === STATES.NOPOSITION_BLOCKED) {
        // Block entry
        if (this.state !== STATES.NOPOSITION_BLOCKED) {
          this.blockedAtMs = Date.now();
          this.logStateChange('BLOCKED', { trigger, prevState });
        }
        this.state = STATES.NOPOSITION_BLOCKED;
      }
    }
  }

  // Called every minute at :00 to retry blocked positions
  minuteRetry() {
    if (this.state !== STATES.NOPOSITION_BLOCKED) return false;
    
    this.lastCheckedAtMs = Date.now();
    this.logStateChange('MINUTE_RETRY', { prevState: this.state });
    this.evaluate('MINUTE_RETRY');
    return true;
  }

  // Get current state snapshot
  getSnapshot() {
    return {
      symbol: this.symbol,
      state: this.state,
      ltp: this.ltp,
      threshold: this.threshold,
      blockedAtMs: this.blockedAtMs,
      lastCheckedAtMs: this.lastCheckedAtMs,
      entryPrice: this.entryPrice,
      stateLog: this.stateLog.slice(0, 10) // Send last 10 entries
    };
  }

  // Reset FSM
  reset() {
    this.state = STATES.NOSIGNAL;
    this.threshold = null;
    this.blockedAtMs = null;
    this.lastCheckedAtMs = null;
    this.entryPrice = null;
    this.logStateChange('RESET', {});
  }
}

module.exports = { FSM, STATES };
