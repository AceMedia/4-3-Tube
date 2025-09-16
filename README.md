# YouTube 4:3 Fullscreen Crop (ACE)

Make every YouTube video snap to a **true 4:3** box when you go fullscreen. Widescreen gets the sides trimmed; vertical gets top/bottom trimmed. Includes **global overscan** and **per-video overrides** (pan X/Y and overscan). Pure CSS/JS — no canvas hacks.

## New in v0.1.2
- **On-player settings panel (non-fullscreen):** click the small **4:3** pill at the bottom-right of the player to preview and save per‑video overrides before you go fullscreen.
- **Controls preserved in fullscreen:** our crop frame now sits **under** YouTube controls (lower z-index) so their UI stays visible and clickable.
- Keeps the v0.1.1 CRT fix: aggressive CSS overrides and re-wrap on fullscreen entry.

## What it does

- Inserts a dedicated 4:3 frame over the fullscreen player (under YT controls).
- Moves the `<video>` element into that frame and uses `object-fit: cover`.
- Optional overscan for a tiny zoom-in to hide edge artefacts.
- Per-video pan/overscan overrides saved by YouTube video ID.
- Only active **in fullscreen**; normal page layout remains untouched.
- Survives YouTube SPA routing and video element swaps.

## Install (Firefox Dev)

1. Download the zip and extract it.
2. Firefox → open `about:debugging#/runtime/this-firefox`.
3. Click **"Load Temporary Add-on…"** and select `manifest.json` inside the folder.
4. Open a YouTube video. Use the **4:3** pill (bottom-right of the player) to preview/save per‑video settings. Then go fullscreen to watch with the 4:3 crop.

## Install (Chrome/Chromium)

1. Extract the zip.
2. Chrome → `chrome://extensions/` → enable **Developer mode**.
3. Click **Load unpacked** → select the extracted folder.

## Files

```
yt-43-crop/
  ├─ manifest.json        # MV3 manifest (Firefox + Chrome)
  ├─ content.js           # Wraps the video in a 4:3 frame in fullscreen + non-FS settings panel
  ├─ style.css            # The 4:3 frame and panel styles
  ├─ popup.html/.js       # Toolbar popup (global/per-video quick edit)
  ├─ options.html/.js     # Global defaults (overscan, pan X/Y)
  └─ README.md
```

## Settings model

- **Global** (`chrome.storage.sync.globals`): `enabled`, `overscan`, `panX`, `panY`.
- **Per video**: stored under key `yt:<VIDEO_ID>` with any of: `overscan`, `panX`, `panY`.
- Live preview in non-fullscreen adjusts CSS variables immediately; **Save** writes to storage.

## Already 4:3?

When the source video is already ~4:3, we temporarily zero overscan on navigation to avoid unnecessary zoom.

## Troubleshooting

- **Controls unclickable in fullscreen**: fixed by lowering the crop frame’s z-index below YouTube controls. If you still hit a theme/experiment where controls hide, tell us the CSS class so we can add a specific z-index bump.
- **Shorts look odd**: This will crop heavy top/bottom. That’s the point: the output is 4:3.

## Roadmap

- Keyboard nudges in fullscreen (arrow keys to pan, `[`/`]` to overscan, `S` to save per-video).
- Alternate target aspects (5:4, 3:2).

## License

MIT © ACE