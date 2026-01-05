/**
 * Multi-Account Order Placement Module
 * Places orders to multiple Zerodha accounts simultaneously
 */

const KiteConnect = require('kiteconnect').KiteConnect;
const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

// Array of { id, name, kite, enabled }
let accounts = [];

// Load accounts from JSON file
function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[MultiOrders] Failed to load accounts:', err.message);
  }
  return [];
}

// Save accounts to JSON file
function saveAccounts(accountsData) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2));
    console.log('[MultiOrders] Accounts saved');
    return true;
  } catch (err) {
    console.error('[MultiOrders] Failed to save accounts:', err.message);
    return false;
  }
}

// Initialize KiteConnect for all accounts
function init() {
  const rawAccounts = loadAccounts();
  accounts = [];
  
  console.log('[MultiOrders] ═══════════════════════════════════════');
  console.log('[MultiOrders] INITIALIZING MULTI-ACCOUNT ORDERS');
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  for (const acc of rawAccounts) {
    if (!acc.api_key || !acc.access_token) {
      console.log(`[MultiOrders] ⚠️ ${acc.name}: Missing credentials, skipping`);
      continue;
    }
    
    try {
      const kite = new KiteConnect({ api_key: acc.api_key });
      kite.setAccessToken(acc.access_token);
      
      accounts.push({
        id: acc.id,
        name: acc.name,
        kite,
        enabled: acc.enabled !== false
      });
      
      console.log(`[MultiOrders] ✅ ${acc.name}: Initialized (${acc.enabled !== false ? 'enabled' : 'disabled'})`);
    } catch (err) {
      console.error(`[MultiOrders] ❌ ${acc.name}: Failed to initialize - ${err.message}`);
    }
  }
  
  console.log(`[MultiOrders] Total accounts: ${accounts.length}`);
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  return accounts.length;
}

// Reload accounts (call after editing accounts.json or via API)
function reload() {
  console.log('[MultiOrders] Reloading accounts...');
  return init();
}

// Callback for when token is updated (to reconnect KiteTicker)
let onTokenUpdateCallback = null;

function setOnTokenUpdate(callback) {
  onTokenUpdateCallback = callback;
}

// Get primary account (first enabled) for KiteTicker
function getPrimaryAccount() {
  const rawAccounts = loadAccounts();
  const enabled = rawAccounts.find(acc => acc.enabled !== false && acc.api_key && acc.access_token);
  if (enabled) {
    return {
      api_key: enabled.api_key,
      access_token: enabled.access_token,
      name: enabled.name
    };
  }
  return null;
}

// Get all accounts (for API)
function getAccounts() {
  const rawAccounts = loadAccounts();
  // Return without sensitive data (api_secret and access_token hidden)
  return rawAccounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    api_key: acc.api_key,  // Needed for Zerodha login URL
    enabled: acc.enabled,
    hasCredentials: !!(acc.api_key && acc.access_token),
    hasApiSecret: !!acc.api_secret,
    last_order: acc.last_order,
    last_token_update: acc.last_token_update,
    created_at: acc.created_at
  }));
}

// Add new account
function addAccount(account) {
  const rawAccounts = loadAccounts();
  
  const newAccount = {
    id: `acc_${Date.now()}`,
    name: account.name || 'New Account',
    api_key: account.api_key || '',
    api_secret: account.api_secret || '',  // Needed for OAuth token generation
    access_token: account.access_token || '',
    enabled: true,
    created_at: new Date().toISOString(),
    last_order: null
  };
  
  rawAccounts.push(newAccount);
  saveAccounts(rawAccounts);
  reload();
  
  return { id: newAccount.id, name: newAccount.name };
}

// Update account
function updateAccount(id, updates) {
  const rawAccounts = loadAccounts();
  const index = rawAccounts.findIndex(a => a.id === id);
  
  if (index === -1) {
    throw new Error('Account not found');
  }
  
  // Only update allowed fields
  if (updates.name) rawAccounts[index].name = updates.name;
  if (updates.api_key) rawAccounts[index].api_key = updates.api_key;
  if (updates.api_secret) rawAccounts[index].api_secret = updates.api_secret;
  if (updates.access_token) rawAccounts[index].access_token = updates.access_token;
  if (typeof updates.enabled === 'boolean') rawAccounts[index].enabled = updates.enabled;
  
  saveAccounts(rawAccounts);
  reload();
  
  return { id, updated: true };
}

// Find account by API key (for OAuth callback)
function findByApiKey(apiKey) {
  const rawAccounts = loadAccounts();
  return rawAccounts.find(a => a.api_key === apiKey);
}

// Update access token by API key (for OAuth callback)
function updateAccessTokenByApiKey(apiKey, accessToken) {
  const rawAccounts = loadAccounts();
  const index = rawAccounts.findIndex(a => a.api_key === apiKey);
  
  if (index === -1) {
    throw new Error('Account not found for this API key');
  }
  
  rawAccounts[index].access_token = accessToken;
  rawAccounts[index].last_token_update = new Date().toISOString();
  
  saveAccounts(rawAccounts);
  reload();
  
  console.log(`[MultiOrders] ✅ Token updated for ${rawAccounts[index].name}`);
  
  // Check if this is the primary account and trigger reconnect
  const primary = getPrimaryAccount();
  if (primary && primary.api_key === apiKey && onTokenUpdateCallback) {
    console.log('[MultiOrders] Primary account token updated - triggering KiteTicker reconnect...');
    onTokenUpdateCallback();
  }
  
  return { name: rawAccounts[index].name, updated: true };
}

// Delete account
function deleteAccount(id) {
  const rawAccounts = loadAccounts();
  const filtered = rawAccounts.filter(a => a.id !== id);
  
  if (filtered.length === rawAccounts.length) {
    throw new Error('Account not found');
  }
  
  saveAccounts(filtered);
  reload();
  
  return { id, deleted: true };
}

// Update last order timestamp
function updateLastOrder(id) {
  const rawAccounts = loadAccounts();
  const index = rawAccounts.findIndex(a => a.id === id);
  
  if (index !== -1) {
    rawAccounts[index].last_order = new Date().toISOString();
    saveAccounts(rawAccounts);
  }
}

// Place order on a single account
async function placeOrderOnAccount(account, instrument, transactionType) {
  const startTime = Date.now();
  
  try {
    const order = await account.kite.placeOrder('regular', {
      exchange: instrument.exchange,
      tradingsymbol: instrument.zerodha,
      transaction_type: transactionType,
      quantity: instrument.lot,
      product: 'MIS',
      order_type: 'MARKET',
      validity: 'DAY'
    });
    
    const duration = Date.now() - startTime;
    updateLastOrder(account.id);
    
    return {
      account: account.name,
      accountId: account.id,
      success: true,
      orderId: order.order_id,
      duration,
      message: `Order placed in ${duration}ms`
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    
    return {
      account: account.name,
      accountId: account.id,
      success: false,
      error: err.message,
      duration,
      message: `Failed: ${err.message}`
    };
  }
}

// Place BUY orders on ALL enabled accounts (parallel)
async function buyAllAccounts(instrument) {
  console.log('[MultiOrders] ═══════════════════════════════════════');
  console.log(`[MultiOrders] 🔴 LIVE BUY - ALL ACCOUNTS`);
  console.log(`[MultiOrders] Instrument: ${instrument.zerodha} x ${instrument.lot}`);
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  const enabledAccounts = accounts.filter(a => a.enabled);
  
  if (enabledAccounts.length === 0) {
    console.log('[MultiOrders] ⚠️ No enabled accounts!');
    return { success: false, message: 'No enabled accounts', results: [] };
  }
  
  console.log(`[MultiOrders] Placing BUY on ${enabledAccounts.length} accounts...`);
  
  const startTime = Date.now();
  
  // Fire all orders simultaneously
  const results = await Promise.allSettled(
    enabledAccounts.map(acc => placeOrderOnAccount(acc, instrument, 'BUY'))
  );
  
  const totalDuration = Date.now() - startTime;
  
  // Process results
  const processed = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    } else {
      return {
        account: enabledAccounts[i].name,
        accountId: enabledAccounts[i].id,
        success: false,
        error: r.reason?.message || 'Unknown error'
      };
    }
  });
  
  // Log results
  const successCount = processed.filter(r => r.success).length;
  const failCount = processed.filter(r => !r.success).length;
  
  console.log('[MultiOrders] ───────────────────────────────────────');
  for (const r of processed) {
    if (r.success) {
      console.log(`[MultiOrders] ✅ ${r.account}: Order ${r.orderId} (${r.duration}ms)`);
    } else {
      console.log(`[MultiOrders] ❌ ${r.account}: ${r.error}`);
    }
  }
  console.log('[MultiOrders] ───────────────────────────────────────');
  console.log(`[MultiOrders] Total: ${successCount}/${enabledAccounts.length} success, ${failCount} failed`);
  console.log(`[MultiOrders] All orders fired in ${totalDuration}ms`);
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  return {
    success: successCount > 0,
    total: enabledAccounts.length,
    successCount,
    failCount,
    totalDuration,
    results: processed
  };
}

// Place SELL orders on ALL enabled accounts (parallel)
async function sellAllAccounts(instrument) {
  console.log('[MultiOrders] ═══════════════════════════════════════');
  console.log(`[MultiOrders] 🟢 LIVE SELL - ALL ACCOUNTS`);
  console.log(`[MultiOrders] Instrument: ${instrument.zerodha} x ${instrument.lot}`);
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  const enabledAccounts = accounts.filter(a => a.enabled);
  
  if (enabledAccounts.length === 0) {
    console.log('[MultiOrders] ⚠️ No enabled accounts!');
    return { success: false, message: 'No enabled accounts', results: [] };
  }
  
  console.log(`[MultiOrders] Placing SELL on ${enabledAccounts.length} accounts...`);
  
  const startTime = Date.now();
  
  // Fire all orders simultaneously
  const results = await Promise.allSettled(
    enabledAccounts.map(acc => placeOrderOnAccount(acc, instrument, 'SELL'))
  );
  
  const totalDuration = Date.now() - startTime;
  
  // Process results
  const processed = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    } else {
      return {
        account: enabledAccounts[i].name,
        accountId: enabledAccounts[i].id,
        success: false,
        error: r.reason?.message || 'Unknown error'
      };
    }
  });
  
  // Log results
  const successCount = processed.filter(r => r.success).length;
  const failCount = processed.filter(r => !r.success).length;
  
  console.log('[MultiOrders] ───────────────────────────────────────');
  for (const r of processed) {
    if (r.success) {
      console.log(`[MultiOrders] ✅ ${r.account}: Order ${r.orderId} (${r.duration}ms)`);
    } else {
      console.log(`[MultiOrders] ❌ ${r.account}: ${r.error}`);
    }
  }
  console.log('[MultiOrders] ───────────────────────────────────────');
  console.log(`[MultiOrders] Total: ${successCount}/${enabledAccounts.length} success, ${failCount} failed`);
  console.log(`[MultiOrders] All orders fired in ${totalDuration}ms`);
  console.log('[MultiOrders] ═══════════════════════════════════════');
  
  return {
    success: successCount > 0,
    total: enabledAccounts.length,
    successCount,
    failCount,
    totalDuration,
    results: processed
  };
}

// Get enabled account count
function getEnabledCount() {
  return accounts.filter(a => a.enabled).length;
}

module.exports = {
  init,
  reload,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  findByApiKey,
  updateAccessTokenByApiKey,
  getPrimaryAccount,
  setOnTokenUpdate,
  buyAllAccounts,
  sellAllAccounts,
  getEnabledCount
};
