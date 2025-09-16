function getActiveTabUrl() {
  return new Promise(resolve => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => resolve(tabs[0]?.url || ''));
  });
}

function parseVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    }
  } catch(e){}
  return null;
}

async function load() {
  const url = await getActiveTabUrl();
  const vid = parseVideoId(url);
  document.getElementById('vid').textContent = vid ? `Video ID: ${vid}` : 'Not a watch page';

  chrome.storage.sync.get(null, (all) => {
    const g = all.globals || { enabled: true, overscan: 0, panX: 0, panY: 0 };
    document.getElementById('enabled').checked = !!g.enabled;
    document.getElementById('overscan').value = g.overscan ?? 0;

    const pv = vid ? all[`yt:${vid}`] : null;
    document.getElementById('pvOverscan').value = pv?.overscan ?? '';
    document.getElementById('pvPanX').value = pv?.panX ?? '';
    document.getElementById('pvPanY').value = pv?.panY ?? '';
  });
}

document.getElementById('save').addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  const vid = parseVideoId(url);

  const enabled = document.getElementById('enabled').checked;
  const overscan = parseInt(document.getElementById('overscan').value || '0', 10);

  const pvOverscan = document.getElementById('pvOverscan').value;
  const pvPanX = document.getElementById('pvPanX').value;
  const pvPanY = document.getElementById('pvPanY').value;

  const updates = { globals: { enabled, overscan } };

  if (vid) {
    const key = `yt:${vid}`;
    const pv = {};
    if (pvOverscan !== '') pv.overscan = parseInt(pvOverscan, 10);
    if (pvPanX !== '') pv.panX = parseInt(pvPanX, 10);
    if (pvPanY !== '') pv.panY = parseInt(pvPanY, 10);
    if (Object.keys(pv).length) updates[key] = pv;
  }

  chrome.storage.sync.set(updates, () => {
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, {type: 'ace43:update'});
    });
    window.close();
  });
});

document.getElementById('clear').addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  const vid = parseVideoId(url);
  if (!vid) return;
  chrome.storage.sync.remove(`yt:${vid}`, () => {
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, {type: 'ace43:update'});
    });
    window.close();
  });
});

document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();