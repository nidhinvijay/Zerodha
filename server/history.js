/**
 * History Module
 * Saves daily trading data to JSON file for reference
 */

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'history.json');

// Load existing history
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[History] Failed to load:', err.message);
  }
  return { days: [] };
}

// Save history to file
function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log('[History] Saved to file');
  } catch (err) {
    console.error('[History] Failed to save:', err.message);
  }
}

// Save current day's data
function saveDay(instruments, fsmManager, signals) {
  const history = loadHistory();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Build day data for each instrument
  const instrumentsData = {};
  for (const inst of instruments) {
    const fsm = fsmManager.getFsm(inst.token);
    const instSignals = fsmManager.getSignals(inst.token);
    
    if (fsm) {
      const snapshot = fsm.getSnapshot(); // Still needed for PnL summaries if computed
      instrumentsData[inst.zerodha] = {
        token: inst.token,
        exchange: inst.exchange,
        lot: inst.lot,
        // PnL summary
        paperRealizedPnL: snapshot.realizedPnL,
        liveRealizedPnL: snapshot.liveRealizedPnL,
        // Trades (Use direct access for full history)
        paperTrades: fsm.paperTrades || [],
        liveTrades: fsm.liveTrades || [],
        // Logs
        stateLog: fsm.stateLog || [],
        signals: instSignals || []
      };
    }
  }
  
  const dayData = {
    date: today,
    savedAt: new Date().toISOString(),
    instruments: instrumentsData
  };
  
  // Check if today already exists, replace it
  const existingIndex = history.days.findIndex(d => d.date === today);
  if (existingIndex >= 0) {
    history.days[existingIndex] = dayData;
  } else {
    history.days.unshift(dayData); // Add to beginning
  }
  
  saveHistory(history);
  console.log(`[History] ═══════════════════════════════════════`);
  console.log(`[History] SAVED DAY DATA: ${today}`);
  console.log(`[History] Instruments: ${Object.keys(instrumentsData).length}`);
  console.log(`[History] ═══════════════════════════════════════`);
  
  return dayData;
}

// Get all history
function getHistory() {
  return loadHistory();
}

// Get specific day
function getDay(date) {
  const history = loadHistory();
  return history.days.find(d => d.date === date);
}

// Get list of dates
function getDates() {
  const history = loadHistory();
  return history.days.map(d => ({ date: d.date, savedAt: d.savedAt }));
}

module.exports = {
  saveDay,
  getHistory,
  getDay,
  getDates
};
