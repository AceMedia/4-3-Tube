const DEFAULTS = { enabled: true, overscan: 0, panX: 0, panY: 0 };

function load() {
  chrome.storage.sync.get('globals', ({globals}) => {
    const g = { ...DEFAULTS, ...(globals || {}) };
    document.getElementById('enabled').checked = !!g.enabled;
    document.getElementById('overscan').value = g.overscan;
    document.getElementById('panX').value = g.panX;
    document.getElementById('panY').value = g.panY;
  });
}

document.getElementById('save').addEventListener('click', () => {
  const enabled = document.getElementById('enabled').checked;
  const overscan = parseInt(document.getElementById('overscan').value || '0', 10);
  const panX = parseInt(document.getElementById('panX').value || '0', 10);
  const panY = parseInt(document.getElementById('panY').value || '0', 10);
  chrome.storage.sync.set({ globals: { enabled, overscan, panX, panY } }, () => {
    chrome.tabs.query({url: '*://*.youtube.com/*'}, tabs => {
      for (const t of tabs) chrome.tabs.sendMessage(t.id, {type: 'ace43:update'});
    });
  });
});

load();