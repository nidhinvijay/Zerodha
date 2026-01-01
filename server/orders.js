/**
 * Zerodha Order Placement Module
 * Places MARKET orders when live trading activates/closes
 */

const KiteConnect = require('kiteconnect').KiteConnect;

let kite = null;

// Initialize KiteConnect
function init() {
  const apiKey = process.env.KITE_API_KEY;
  const accessToken = process.env.KITE_ACCESS_TOKEN;
  
  if (!apiKey || !accessToken) {
    console.warn('[Orders] Missing API credentials, live orders disabled');
    return false;
  }
  
  kite = new KiteConnect({ api_key: apiKey });
  kite.setAccessToken(accessToken);
  console.log('[Orders] KiteConnect initialized');
  return true;
}

// Place market order
async function placeOrder(instrument, transactionType) {
  if (!kite) {
    console.log(`[Orders] SIMULATED ${transactionType}: ${instrument.zerodha} x ${instrument.lot}`);
    return { simulated: true, order_id: `SIM_${Date.now()}` };
  }
  
  try {
    const order = await kite.placeOrder('regular', {
      exchange: instrument.exchange,
      tradingsymbol: instrument.zerodha,
      transaction_type: transactionType, // "BUY" or "SELL"
      quantity: instrument.lot,
      product: 'MIS',  // Intraday
      order_type: 'MARKET',
      validity: 'DAY'
    });
    
    console.log(`[Orders] ${transactionType} order placed:`, order);
    return order;
  } catch (error) {
    console.error(`[Orders] ${transactionType} order failed:`, error.message);
    throw error;
  }
}

// Place BUY order (when live activates)
async function buyOrder(instrument) {
  console.log(`[Orders] Placing BUY order: ${instrument.zerodha} x ${instrument.lot}`);
  return placeOrder(instrument, 'BUY');
}

// Place SELL order (when live closes)
async function sellOrder(instrument) {
  console.log(`[Orders] Placing SELL order: ${instrument.zerodha} x ${instrument.lot}`);
  return placeOrder(instrument, 'SELL');
}

module.exports = {
  init,
  buyOrder,
  sellOrder
};
