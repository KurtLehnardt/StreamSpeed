// StreamSpeed — MV3 service worker (background.js)
//
// Responsibilities:
//   1. Normalize persisted settings once on install/update (ssMigrate).
//   2. Optionally observe ad-network requests (opt-in webRequest permission)
//      and send *confidence-only* hints to the tab's content script. The hint
//      carries NO URL and NO PII — it only signals "an ad-network request was
//      seen on this tab" so the content script can adjust behavior heuristically.
//   3. Let the content script request the options page.
//
// This worker never blocks or modifies any request. It is non-blocking and
// purely observational. All listeners are registered at top level so they are
// re-attached idempotently whenever the service worker restarts.

importScripts('content/settings.js');

// --- Install / update: normalize storage exactly once -----------------------
// ssMigrate() is safe on empty storage: it returns the defaults, which we then
// write back so subsequent reads have a fully-populated, versioned shape.
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  const migrated = ssMigrate(stored);
  await chrome.storage.sync.set(migrated);
});

// --- Ad-network observer (permission-gated, lifecycle-tracked) --------------
// The webRequest permission and the ad-network host origins are OPTIONAL and
// opt-in. chrome.webRequest is undefined until the permission is granted, so
// every access to it is guarded.

function adHostFilter() {
  return {
    urls: SS_AD_NETWORK_HOSTS,
    types: ['xmlhttprequest', 'media', 'image', 'sub_frame', 'script']
  };
}

// Non-blocking observer. Sends a confidence-only hint to the tab. We swallow
// chrome.runtime.lastError because the target tab may have no content script
// listening (e.g. a background/prefetch request), which is expected.
function onAdRequest(details) {
  if (details.tabId < 0) return;
  try {
    chrome.tabs.sendMessage(
      details.tabId,
      { type: 'SS_AD_NETWORK_HINT', site: null, confidence: 'network', ts: Date.now() },
      () => { void chrome.runtime.lastError; }
    );
  } catch (e) { /* tab gone / no receiver — hints are best-effort only */ }
}

// Reconcile the listener registration with the current settings + permission
// state. Idempotent: only adds when it should run and isn't registered, only
// removes when it shouldn't run but is registered.
async function refreshObserver() {
  const s = await ssGetSettings();
  const has = await chrome.permissions.contains({
    permissions: ['webRequest'],
    origins: SS_AD_NETWORK_HOSTS
  });
  const shouldRun = s.networkAssist && has;
  const isRegistered = chrome.webRequest &&
    chrome.webRequest.onBeforeRequest.hasListener(onAdRequest);
  if (shouldRun && !isRegistered) {
    chrome.webRequest.onBeforeRequest.addListener(onAdRequest, adHostFilter());
  } else if (!shouldRun && isRegistered) {
    chrome.webRequest.onBeforeRequest.removeListener(onAdRequest);
  }
}

// Run once on service-worker startup...
refreshObserver();

// ...and whenever the opt-in permission is granted/revoked...
chrome.permissions.onAdded.addListener(refreshObserver);
chrome.permissions.onRemoved.addListener(refreshObserver);

// ...and whenever the networkAssist toggle (in 'sync' storage) may have changed.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') refreshObserver();
});

// --- Messages ---------------------------------------------------------------
// Validate the sender id as defense in depth: only accept messages from this
// extension's own content scripts / pages.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender || sender.id !== chrome.runtime.id) return;
  if (msg && msg.type === 'SS_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
  }
});
