// ACE: YouTube 4:3 Fullscreen Crop content script (v0.1.2)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const DEFAULTS = {
  enabled: true,
  overscan: 0,     // percent (0..100)
  panX: 0,         // px
  panY: 0,         // px
};

let state = {
  ...DEFAULTS,
  videoId: null,
  perVideo: null,
  panelVisible: false,
  cache: {}
};

const api = typeof browser !== 'undefined' ? browser : chrome;

/* ========= Core detection and state ========= */
function getVideoIdFromUrl(url = location.href) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    }
  } catch(e) {}
  return null;
}

function loadSettings(videoId) {
  return new Promise(resolve => {
    api.storage.sync.get(null, (all) => {
      const merged = { ...DEFAULTS, ...all.globals };
      const perVideo = all[`yt:${videoId}`] || null;
      state = { ...state, ...merged, videoId, perVideo };
      resolve();
    });
  });
}

function applyCssVars() {
  const root = document.documentElement;
  const overscan = (state.perVideo?.overscan ?? state.overscan) || 0;
  const panX = (state.perVideo?.panX ?? state.panX) || 0;
  const panY = (state.perVideo?.panY ?? state.panY) || 0;

  root.style.setProperty('--ace43-overscan', overscan);
  root.style.setProperty('--ace43-pan-x', `${panX}px`);
  root.style.setProperty('--ace43-pan-y', `${panY}px`);
}

function closestPlayer(el) {
  return el?.closest?.('.html5-video-player') || $('.html5-video-player');
}

function getCurrentVideoEl() {
  return $('video.html5-main-video') || $('video.video-stream') || $('video');
}

function inFullscreen() {
  return !!document.fullscreenElement;
}

/* ========= Fullscreen 4:3 frame ========= */
function ensureFrame(videoEl) {
  const player = closestPlayer(videoEl);
  if (!player) return null;

  if (!player.classList.contains('ace-43-active')) {
    player.classList.add('ace-43-active');

    let frame = player.querySelector('.ace-43-frame');
    if (!frame) {
      frame = document.createElement('div');
      frame.className = 'ace-43-frame';
      const inner = document.createElement('div');
      inner.className = 'ace-43-frame-inner';
      const wrap = document.createElement('div');
      wrap.className = 'ace-43-video-wrap';
      inner.appendChild(wrap);
      frame.appendChild(inner);
      player.appendChild(frame);
    }

    const wrap = player.querySelector('.ace-43-video-wrap');
    if (videoEl.parentElement !== wrap) wrap.appendChild(videoEl);
  }
  return player;
}

function removeFrame(videoEl) {
  const player = closestPlayer(videoEl);
  if (!player) return;
  const wrap = player.querySelector('.ace-43-video-wrap');
  const originalContainer = player.querySelector('.html5-video-container') || player;
  const frame = player.querySelector('.ace-43-frame');

  const video = wrap?.querySelector('video');
  if (video && originalContainer) originalContainer.appendChild(video);

  if (frame) frame.remove();
  player.classList.remove('ace-43-active');
}

function onFullscreenChange() {
  const active = inFullscreen() && state.enabled;
  const video = getCurrentVideoEl();
  if (!video) return;

  if (active) {
    ensureFrame(video);
    // Re-assert after layout settles in fullscreen
    requestAnimationFrame(() => ensureFrame(getCurrentVideoEl() || video));
    setTimeout(() => ensureFrame(getCurrentVideoEl() || video), 250);
  } else {
    removeFrame(video);
  }
}

/* ========= SPA navigation hooks ========= */
function onNavigationChange() {
  const vid = getVideoIdFromUrl();
  if (!vid) return;
  loadSettings(vid).then(() => {
    applyCssVars();

    // Auto-zero overscan for native ~4:3 sources
    try {
      const v = getCurrentVideoEl();
      if (v && v.videoWidth && v.videoHeight) {
        const ar = v.videoWidth / v.videoHeight;
        if (Math.abs(ar - 4/3) < 0.01) {
          document.documentElement.style.setProperty('--ace43-overscan', 0);
        }
      }
    } catch(e){}

    // Show/update per-video panel in non-fullscreen
    tryMountPanel();

    // Rehook the current video if we’re already in fullscreen
    if (inFullscreen() && state.enabled) {
      const video = getCurrentVideoEl();
      if (video) ensureFrame(video);
    }
  });
}

function observeVideoReplacement() {
  const root = $('ytd-player') || document.body;
  if (!root) return;

  const mo = new MutationObserver(() => {
    if (!state.enabled) return;
    if (inFullscreen()) {
      const video = getCurrentVideoEl();
      if (video) ensureFrame(video);
    } else {
      tryMountPanel(); // keep panel anchored to the current player
    }
  });
  mo.observe(root, { childList: true, subtree: true });
}

function initSpaHooks() {
  window.addEventListener('yt-navigate-finish', onNavigationChange, true);
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      onNavigationChange();
    }
  }, 800);
}

function initFullscreenHooks() {
  document.addEventListener('fullscreenchange', onFullscreenChange, true);
}

/* ========= Non-fullscreen per-video panel ========= */
let panel, toggleBtn, shadowRoot;

function tryMountPanel() {
  if (inFullscreen()) return destroyPanel();

  const player = $('.html5-video-player');
  if (!player) return destroyPanel();

  // Host container positioned relative to player controls area
  let host = player.querySelector('.ace43-panel-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'ace43-panel-host';
    // place it at end so it sits above thumbnails etc
    player.appendChild(host);
  }

  if (!panel) {
    const mount = document.createElement('div');
    host.appendChild(mount);
    shadowRoot = mount.attachShadow({mode:'open'});

    toggleBtn = document.createElement('button');
    toggleBtn.className = 'ace43-toggle';
    toggleBtn.textContent = '4:3';
    toggleBtn.title = 'Show 4:3 settings';
    toggleBtn.addEventListener('click', () => {
      state.panelVisible = !state.panelVisible;
      renderPanel();
    });

    panel = document.createElement('div');
    panel.className = 'ace43-panel';

    shadowRoot.appendChild(toggleBtn);
    shadowRoot.appendChild(panel);
  }
  renderPanel();
}

function destroyPanel() {
  panel = null;
  toggleBtn = null;
  shadowRoot = null;
  const hosts = $$('.ace43-panel-host');
  hosts.forEach(h => h.remove());
}

function renderPanel() {
  if (!shadowRoot) return;
  // Update toggle visibility depending on fullscreen
  toggleBtn.style.display = inFullscreen() ? 'none' : 'block';
  panel.style.display = state.panelVisible ? 'block' : 'none';

  const vid = state.videoId || getVideoIdFromUrl() || '—';
  const gOverscan = state.overscan ?? 0;
  const pv = state.perVideo || {};

  panel.innerHTML = `
    <div class="ace43-header">
      <div>4:3 Settings</div>
      <div style="opacity:.7;">${vid ? 'ID: ' + vid : ''}</div>
    </div>
    <div class="ace43-row">
      <label>Overscan</label>
      <input type="number" id="gOverscan" min="0" max="100" step="1" value="${gOverscan}" />
    </div>
    <div class="ace43-row" style="margin-top:8px; font-weight:600;">Per-video override</div>
    <div class="ace43-row">
      <label>Overscan</label>
      <input type="number" id="pvOverscan" min="0" max="100" step="1" value="${pv.overscan ?? ''}" />
    </div>
    <div class="ace43-row">
      <label>Pan X</label>
      <input type="number" id="pvPanX" step="1" value="${pv.panX ?? ''}" />
    </div>
    <div class="ace43-row">
      <label>Pan Y</label>
      <input type="number" id="pvPanY" step="1" value="${pv.panY ?? ''}" />
    </div>
    <div class="ace43-row" style="margin-top:10px; gap:10px;">
      <button class="ace43-btn" id="save">Save</button>
      <button class="ace43-btn" id="clear">Clear</button>
    </div>
  `;

  panel.querySelector('#save').onclick = onPanelSave;
  panel.querySelector('#clear').onclick = onPanelClear;
  panel.querySelector('#gOverscan').oninput = e => livePreview('overscan', parseInt(e.target.value||'0',10));
  panel.querySelector('#pvOverscan').oninput = e => livePreview('pvOverscan', e.target.value === '' ? null : parseInt(e.target.value,10));
  panel.querySelector('#pvPanX').oninput = e => livePreview('pvPanX', e.target.value === '' ? null : parseInt(e.target.value,10));
  panel.querySelector('#pvPanY').oninput = e => livePreview('pvPanY', e.target.value === '' ? null : parseInt(e.target.value,10));
}

function livePreview(kind, val) {
  // Update state and CSS vars for immediate feedback while not fullscreen
  if (kind === 'overscan') state.overscan = isNaN(val)?0:val;
  if (kind === 'pvOverscan') { if (!state.perVideo) state.perVideo = {}; state.perVideo.overscan = val; }
  if (kind === 'pvPanX') { if (!state.perVideo) state.perVideo = {}; state.perVideo.panX = val; }
  if (kind === 'pvPanY') { if (!state.perVideo) state.perVideo = {}; state.perVideo.panY = val; }
  applyCssVars();
}

function onPanelSave() {
  const vid = state.videoId || getVideoIdFromUrl();
  if (!vid) return;

  const gOverscan = parseInt(shadowRoot.querySelector('#gOverscan').value || '0', 10);
  const pvOverscan = shadowRoot.querySelector('#pvOverscan').value;
  const pvPanX = shadowRoot.querySelector('#pvPanX').value;
  const pvPanY = shadowRoot.querySelector('#pvPanY').value;

  const updates = { globals: { enabled: true, overscan: gOverscan, panX: state.panX, panY: state.panY } };
  const key = `yt:${vid}`;
  const pv = {};
  if (pvOverscan !== '') pv.overscan = parseInt(pvOverscan, 10);
  if (pvPanX !== '') pv.panX = parseInt(pvPanX, 10);
  if (pvPanY !== '') pv.panY = parseInt(pvPanY, 10);
  if (Object.keys(pv).length) updates[key] = pv;

  api.storage.sync.set(updates, () => {
    api.runtime.sendMessage({type:'ace43:update'});
    state.panelVisible = false;
    renderPanel();
  });
}

function onPanelClear() {
  const vid = state.videoId || getVideoIdFromUrl();
  if (!vid) return;
  api.storage.sync.remove(`yt:${vid}`, () => {
    state.perVideo = null;
    applyCssVars();
    renderPanel();
  });
}

/* ========= Init ========= */
function init() {
  initSpaHooks();
  initFullscreenHooks();
  observeVideoReplacement();
  onNavigationChange();
}
init();

api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'ace43:update') {
    onNavigationChange();
  }
});