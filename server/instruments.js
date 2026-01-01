/**
 * Instruments Manager
 * Loads instruments from INSTRUMENTS_DATA env variable
 */

function loadInstruments() {
  const raw = process.env.INSTRUMENTS_DATA;
  
  if (!raw) {
    console.warn("[Instruments] No INSTRUMENTS_DATA in .env, using empty array");
    return [];
  }
  
  try {
    const instruments = JSON.parse(raw);
    console.log(`[Instruments] Loaded ${instruments.length} instruments`);
    return instruments;
  } catch (e) {
    console.error("[Instruments] Failed to parse INSTRUMENTS_DATA:", e.message);
    return [];
  }
}

// Get instrument by tradingview symbol (for webhook matching)
function findByTradingview(instruments, tvSymbol) {
  return instruments.find(i => i.tradingview === tvSymbol);
}

// Get instrument by zerodha token (for tick matching)
function findByToken(instruments, token) {
  return instruments.find(i => i.token === token);
}

// Get all tokens (for KiteTicker subscription)
function getAllTokens(instruments) {
  return instruments.map(i => i.token);
}

module.exports = {
  loadInstruments,
  findByTradingview,
  findByToken,
  getAllTokens
};
