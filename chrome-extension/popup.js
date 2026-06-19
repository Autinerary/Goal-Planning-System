// Goal Focus - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  const settings = response.settings;

  renderFocusMode(settings);
  renderStats(settings);
  renderSiteList(settings);
  renderTimeLimits(settings);
  renderIncognito(settings);

  // Event listeners
  document.getElementById('focusMode').addEventListener('change', async (e) => {
    await sendMessage({ type: 'TOGGLE_FOCUS_MODE', enabled: e.target.checked });
    refreshPopup();
  });

  document.getElementById('addSiteBtn').addEventListener('click', addSite);
  document.getElementById('newSiteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSite();
  });

  document.getElementById('addTimeLimitBtn').addEventListener('click', addTimeLimit);

  document.getElementById('blockIncognito').addEventListener('change', async (e) => {
    await sendMessage({ type: 'TOGGLE_INCOGNITO_BLOCK', enabled: e.target.checked });
  });
});

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

async function refreshPopup() {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  const settings = response.settings;
  renderFocusMode(settings);
  renderStats(settings);
  renderSiteList(settings);
  renderTimeLimits(settings);
}

function renderFocusMode(settings) {
  const checkbox = document.getElementById('focusMode');
  const box = document.getElementById('focusToggleBox');
  checkbox.checked = settings.focusModeActive;
  if (settings.focusModeActive) {
    box.classList.add('active');
  } else {
    box.classList.remove('active');
  }
}

function renderStats(settings) {
  const blockedCount = settings.blockedSites.filter(s => s.enabled).length;
  const limitsCount = Object.keys(settings.timeLimits).length;
  document.getElementById('sitesBlocked').textContent = blockedCount;
  document.getElementById('timeSaved').textContent = `${limitsCount}`;
}

function renderSiteList(settings) {
  const list = document.getElementById('siteList');
  list.innerHTML = '';

  settings.blockedSites.forEach((site) => {
    const item = document.createElement('div');
    item.className = 'site-item';

    const timeUsed = settings.timeUsed[site.domain] || 0;
    const timeLimit = settings.timeLimits[site.domain];
    let timeInfo = '';
    if (timeLimit) {
      const exceeded = timeUsed >= timeLimit;
      timeInfo = `<span class="${exceeded ? 'time-exceeded' : 'time-info'}">${Math.round(timeUsed)}/${timeLimit}m</span>`;
    }

    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <label class="toggle" style="width:34px;height:18px;">
          <input type="checkbox" ${site.enabled ? 'checked' : ''} data-domain="${site.domain}">
          <span class="slider" style="border-radius:9px;"></span>
        </label>
        <span class="domain">${site.domain}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${timeInfo}
        <button class="btn-remove" data-remove="${site.domain}" title="Remove">✕</button>
      </div>
    `;
    list.appendChild(item);
  });

  // Toggle listeners
  list.querySelectorAll('input[data-domain]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      await sendMessage({ type: 'TOGGLE_SITE', domain: e.target.dataset.domain, enabled: e.target.checked });
    });
  });

  // Remove listeners
  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      await sendMessage({ type: 'REMOVE_BLOCKED_SITE', domain: e.target.dataset.remove });
      refreshPopup();
    });
  });
}

function renderTimeLimits(settings) {
  const list = document.getElementById('timeLimitsList');
  list.innerHTML = '';

  for (const [domain, minutes] of Object.entries(settings.timeLimits)) {
    const used = Math.round(settings.timeUsed[domain] || 0);
    const exceeded = used >= minutes;
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div>
        <span class="domain">${domain}</span>
        <span class="${exceeded ? 'time-exceeded' : 'time-info'}"> — ${used}/${minutes}m</span>
      </div>
      <button class="btn-remove" data-remove-limit="${domain}" title="Remove limit">✕</button>
    `;
    list.appendChild(item);
  }

  list.querySelectorAll('[data-remove-limit]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      await sendMessage({ type: 'REMOVE_TIME_LIMIT', domain: e.target.dataset.removeLimit });
      refreshPopup();
    });
  });
}

function renderIncognito(settings) {
  document.getElementById('blockIncognito').checked = settings.blockIncognito;
}

async function addSite() {
  const input = document.getElementById('newSiteInput');
  const domain = input.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain) return;

  await sendMessage({ type: 'ADD_BLOCKED_SITE', domain });
  input.value = '';
  refreshPopup();
}

async function addTimeLimit() {
  const domainInput = document.getElementById('timeDomainInput');
  const limitInput = document.getElementById('timeLimitInput');
  const domain = domainInput.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const minutes = parseInt(limitInput.value, 10);

  if (!domain || !minutes || minutes <= 0) return;

  await sendMessage({ type: 'SET_TIME_LIMIT', domain, minutes });
  domainInput.value = '';
  limitInput.value = '';
  refreshPopup();
}
