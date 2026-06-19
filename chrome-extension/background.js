// Goal Focus - Background Service Worker
// Handles site blocking, time tracking, and incognito detection

// ─── DEFAULT SETTINGS ───────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  blockedSites: [
    { domain: 'twitter.com', enabled: true },
    { domain: 'x.com', enabled: true },
    { domain: 'instagram.com', enabled: true },
    { domain: 'facebook.com', enabled: false },
    { domain: 'tiktok.com', enabled: false },
    { domain: 'reddit.com', enabled: false },
    { domain: 'youtube.com', enabled: false },
  ],
  timeLimits: {},        // { "twitter.com": 30, "instagram.com": 15 } — minutes per day
  timeUsed: {},          // { "twitter.com": 12.5 } — minutes used today
  blockIncognito: true,
  focusModeActive: false,
  lastResetDate: new Date().toDateString(),
};

// ─── STATE ──────────────────────────────────────────────────────────
let settings = { ...DEFAULT_SETTINGS };
let activeTabDomain = null;
let activeTabStart = null;
let trackingInterval = null;

// ─── INITIALIZATION ─────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    settings = stored.settings;
  }
  await updateBlockRules();
  startDailyReset();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  await checkDailyReset();
  await updateBlockRules();
  startTimeTracking();
});

// ─── SETTINGS MANAGEMENT ────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get('settings');
  settings = stored.settings || DEFAULT_SETTINGS;
}

async function saveSettings() {
  await chrome.storage.local.set({ settings });
}

// ─── SITE BLOCKING (Declarative Net Request) ────────────────────────
async function updateBlockRules() {
  await loadSettings();

  // Get existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);

  // Remove all existing dynamic rules
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  // Build new rules from blocked sites + time-exceeded sites
  const rules = [];
  let ruleId = 1;

  for (const site of settings.blockedSites) {
    if (site.enabled) {
      rules.push({
        id: ruleId++,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
        condition: {
          urlFilter: `||${site.domain}`,
          resourceTypes: ['main_frame']
        }
      });
    }
  }

  // Block sites that exceeded time limits
  for (const [domain, limitMinutes] of Object.entries(settings.timeLimits)) {
    const used = settings.timeUsed[domain] || 0;
    if (used >= limitMinutes) {
      // Check not already blocked by site blocker
      const alreadyBlocked = settings.blockedSites.some(s => s.domain === domain && s.enabled);
      if (!alreadyBlocked) {
        rules.push({
          id: ruleId++,
          priority: 1,
          action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ['main_frame']
          }
        });
      }
    }
  }

  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  }
}

// ─── TIME TRACKING ──────────────────────────────────────────────────
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function startTimeTracking() {
  // Track active tab changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabChange(tab.url);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      handleTabChange(changeInfo.url);
    }
  });

  // Flush time every 10 seconds
  if (trackingInterval) clearInterval(trackingInterval);
  trackingInterval = setInterval(flushActiveTime, 10000);
}

function handleTabChange(url) {
  flushActiveTime();
  const domain = extractDomain(url);
  if (domain && settings.timeLimits[domain] !== undefined) {
    activeTabDomain = domain;
    activeTabStart = Date.now();
  } else {
    activeTabDomain = null;
    activeTabStart = null;
  }
}

async function flushActiveTime() {
  if (!activeTabDomain || !activeTabStart) return;

  const elapsed = (Date.now() - activeTabStart) / 60000; // minutes
  settings.timeUsed[activeTabDomain] = (settings.timeUsed[activeTabDomain] || 0) + elapsed;
  activeTabStart = Date.now();

  await saveSettings();

  // Check if limit exceeded
  const limit = settings.timeLimits[activeTabDomain];
  if (limit && settings.timeUsed[activeTabDomain] >= limit) {
    await updateBlockRules();
    // Close the tab or redirect
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { url: chrome.runtime.getURL('blocked.html') });
    }
    activeTabDomain = null;
    activeTabStart = null;
  }
}

// ─── INCOGNITO BLOCKING ─────────────────────────────────────────────
chrome.tabs.onCreated.addListener(async (tab) => {
  await loadSettings();
  if (settings.blockIncognito && tab.incognito) {
    // Close any incognito tabs
    chrome.tabs.remove(tab.id);
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Incognito Blocked',
      message: 'Incognito mode is disabled by Goal Focus to help you stay accountable.',
    });
  }
});

// ─── DAILY RESET ────────────────────────────────────────────────────
function startDailyReset() {
  chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    await checkDailyReset();
  }
});

async function checkDailyReset() {
  await loadSettings();
  const today = new Date().toDateString();
  if (settings.lastResetDate !== today) {
    settings.timeUsed = {};
    settings.lastResetDate = today;
    await saveSettings();
    await updateBlockRules();
  }
}

// ─── MESSAGE HANDLING (from popup/options) ──────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await loadSettings();

    switch (message.type) {
      case 'GET_SETTINGS':
        sendResponse({ settings });
        break;

      case 'UPDATE_BLOCKED_SITES':
        settings.blockedSites = message.sites;
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'ADD_BLOCKED_SITE':
        settings.blockedSites.push({ domain: message.domain, enabled: true });
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'REMOVE_BLOCKED_SITE':
        settings.blockedSites = settings.blockedSites.filter(s => s.domain !== message.domain);
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'TOGGLE_SITE':
        const site = settings.blockedSites.find(s => s.domain === message.domain);
        if (site) site.enabled = message.enabled;
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'SET_TIME_LIMIT':
        settings.timeLimits[message.domain] = message.minutes;
        await saveSettings();
        sendResponse({ success: true });
        break;

      case 'REMOVE_TIME_LIMIT':
        delete settings.timeLimits[message.domain];
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'TOGGLE_INCOGNITO_BLOCK':
        settings.blockIncognito = message.enabled;
        await saveSettings();
        sendResponse({ success: true });
        break;

      case 'TOGGLE_FOCUS_MODE':
        settings.focusModeActive = message.enabled;
        // In focus mode, enable ALL blocked sites
        if (message.enabled) {
          settings.blockedSites.forEach(s => s.enabled = true);
        }
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      case 'RESET_TIME':
        settings.timeUsed = {};
        await saveSettings();
        await updateBlockRules();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});

// Start tracking on load
startTimeTracking();
