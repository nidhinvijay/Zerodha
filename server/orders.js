/**
 * Zerodha Order Placement Module
 * Places MARKET orders when live trading activates/closes
 * Includes order tracking, position sync, and error alerts
 */

const KiteConnect = require('kiteconnect').KiteConnect;

let kite = null;
const activeOrders = new Map(); // token -> { buyOrderId, sellOrderId }

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

// Get current positions from Zerodha (called on startup)
async function syncPositions() {
  if (!kite) {
    console.log('[Orders] Cannot sync positions - KiteConnect not initialized');
    return [];
  }
  
  try {
    const positions = await kite.getPositions();
    const dayPositions = positions.day || [];
    
    console.log('[Orders] ═══════════════════════════════════════');
    console.log('[Orders] POSITION SYNC ON STARTUP');
    console.log('[Orders] ═══════════════════════════════════════');
    
    if (dayPositions.length === 0) {
      console.log('[Orders] No open positions');
    } else {
      for (const pos of dayPositions) {
        if (pos.quantity !== 0) {
          console.log(`[Orders] OPEN POSITION: ${pos.tradingsymbol} | Qty: ${pos.quantity} | P&L: ${pos.pnl}`);
        }
      }
    }
    
    console.log('[Orders] ═══════════════════════════════════════');
    return dayPositions.filter(p => p.quantity !== 0);
  } catch (error) {
    console.error('[Orders] ⚠️ ALERT: Position sync failed:', error.message);
    return [];
  }
}

// Place market order with tracking
async function placeOrder(instrument, transactionType) {
  if (!kite) {
    console.log(`[Orders] SIMULATED ${transactionType}: ${instrument.zerodha} x ${instrument.lot}`);
    return { simulated: true, order_id: `SIM_${Date.now()}` };
  }
  
  try {
    const order = await kite.placeOrder('regular', {
      exchange: instrument.exchange,
      tradingsymbol: instrument.zerodha,
      transaction_type: transactionType,
      quantity: instrument.lot,
      product: 'MIS',
      order_type: 'MARKET',
      validity: 'DAY'
    });
    
    console.log(`[Orders] ✅ ${transactionType} order placed: ${instrument.zerodha} | Order ID: ${order.order_id}`);
    
    // Track order
    const tracking = activeOrders.get(instrument.token) || {};
    if (transactionType === 'BUY') {
      tracking.buyOrderId = order.order_id;
    } else {
      tracking.sellOrderId = order.order_id;
    }
    activeOrders.set(instrument.token, tracking);
    
    // Verify order status after delay
    setTimeout(() => verifyOrder(order.order_id, instrument, transactionType), 3000);
    
    return order;
  } catch (error) {
    console.error('[Orders] ═══════════════════════════════════════');
    console.error(`[Orders] ⚠️ ALERT: ${transactionType} ORDER FAILED`);
    console.error(`[Orders] Instrument: ${instrument.zerodha}`);
    console.error(`[Orders] Error: ${error.message}`);
    console.error('[Orders] ═══════════════════════════════════════');
    throw error;
  }
}

// Verify order status
async function verifyOrder(orderId, instrument, transactionType) {
  if (!kite) return;
  
  try {
    const orders = await kite.getOrders();
    const order = orders.find(o => o.order_id === orderId);
    
    if (order) {
      if (order.status === 'COMPLETE') {
        console.log(`[Orders] ✅ ${transactionType} order COMPLETED: ${instrument.zerodha} @ ${order.average_price}`);
      } else if (order.status === 'REJECTED') {
        console.error('[Orders] ═══════════════════════════════════════');
        console.error(`[Orders] ⚠️ ALERT: ORDER REJECTED`);
        console.error(`[Orders] Instrument: ${instrument.zerodha}`);
        console.error(`[Orders] Reason: ${order.status_message}`);
        console.error('[Orders] ═══════════════════════════════════════');
      } else {
        console.log(`[Orders] ${transactionType} order status: ${order.status}`);
      }
    }
  } catch (error) {
    console.error('[Orders] Order verification failed:', error.message);
  }
}

// Get tracked orders for an instrument
function getTrackedOrders(token) {
  return activeOrders.get(token) || {};
}

// Place BUY order (when live activates)
async function buyOrder(instrument) {
  console.log('[Orders] ═══════════════════════════════════════');
  console.log(`[Orders] 🔴 LIVE BUY ORDER: ${instrument.zerodha} x ${instrument.lot}`);
  console.log('[Orders] ═══════════════════════════════════════');
  return placeOrder(instrument, 'BUY');
}

// Place SELL order (when live closes)
async function sellOrder(instrument) {
  console.log('[Orders] ═══════════════════════════════════════');
  console.log(`[Orders] 🟢 LIVE SELL ORDER: ${instrument.zerodha} x ${instrument.lot}`);
  console.log('[Orders] ═══════════════════════════════════════');
  return placeOrder(instrument, 'SELL');
}

module.exports = {
  init,
  syncPositions,
  buyOrder,
  sellOrder,
  getTrackedOrders
};
