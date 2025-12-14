# IFTalk TODO - Interactive Fiction Integration

## Current Status (2025-12-13)

### Summary
Server-side Frotz approach is working reliably. Major styling improvements completed for typography and color scheme. Next focus is mobile responsiveness.

---

## Active Branch: `frotz`

**Status:** ✅ Working - styling in progress

**What Works:**
- ✅ Server-side Frotz interpreter via Socket.IO
- ✅ Game loads and responds to commands
- ✅ Voice recognition and TTS narration
- ✅ AI command translation (Ollama)
- ✅ All navigation controls (back, forward, pause, play, skip)
- ✅ Pronunciation dictionary
- ✅ Two-panel input layout (voice + text)

---

## Styling Progress

### ✅ Typography (COMPLETED)
- [x] Added Google Fonts: Crimson Pro (serif) + IBM Plex Mono
- [x] Game text now uses elegant serif font (18px, line-height 1.9)
- [x] Commands use clean monospace (IBM Plex Mono)
- [x] Welcome screen with literary styling
- [x] Consistent font family across all UI elements

### ✅ Color Scheme (COMPLETED)
Implemented refined dark theme - elegant, neutral, literary feel:

| Variable | Color | Purpose |
|----------|-------|---------|
| `--bg-primary` | `#0d0f12` | Deep charcoal background |
| `--bg-secondary` | `#14171c` | Slightly lighter surfaces |
| `--bg-surface` | `#1a1e24` | Cards and panels |
| `--bg-elevated` | `#22272e` | Elevated elements |
| `--accent-primary` | `#8b9dc3` | Muted blue-gray (buttons, links) |
| `--accent-warm` | `#c4a35a` | Warm gold (highlights, headers) |
| `--text-primary` | `#e6e4e0` | Cream white text |
| `--text-secondary` | `#a8a5a0` | Muted secondary text |

- [x] Removed saturated purple/pink gradients
- [x] Neutral charcoal backgrounds
- [x] Muted accent colors
- [x] Warm gold for speaking highlights
- [x] CSS variables for easy theming

### ✅ Layout (COMPLETED)
- [x] Game output area sizing and padding improved
- [x] Mobile responsiveness - comprehensive breakpoints added:
  - Tablet (900px): Condensed header, smaller dropdowns
  - Mobile (768px): Stacked layout, touch-friendly buttons, full-width panels
  - Small mobile (480px): Compact typography and controls
  - Landscape phone: Optimized for horizontal viewing
- [x] Touch-friendly button sizes (min 44-48px)
- [x] Voice panel hidden when not in talk mode (mobile)

### ⬚ Polish (TODO)
- [ ] Loading states
- [ ] Error message styling
- [ ] Transitions and animations refinement
- [ ] Focus states and accessibility
- [ ] Status bar styling (location, score, moves)

---

## Next Steps

### Polish Priority
1. Loading spinner/states for game commands
2. Error message styling
3. Accessibility improvements (focus states, ARIA labels)
4. Status bar with game info

---

## Architecture: Frotz vs Browser-based

| Aspect | Frotz (Server) | ZVM/GlkOte (Browser) |
|--------|----------------|----------------------|
| **Reliability** | ✅ Proven | ❌ Generation counter issues |
| **Setup** | Requires dfrotz binary | Pure JavaScript |
| **Control** | Full text interception | Complex lifecycle |
| **Styling** | Easy - just HTML/CSS | GlkOte dictates structure |
| **Latency** | Network round-trip | Instant |
| **Offline** | ❌ Needs server | ✅ Could work offline |

**Decision:** Frotz wins on reliability. We can always revisit browser-based later.

---

## Files Modified This Session

- `public/index.html`
  - Added Google Fonts link (Crimson Pro, IBM Plex Mono)
  - Changed default input mode to Direct (unchecked toggle)
- `public/styles.css` - Complete styling overhaul
  - CSS custom properties (variables) for theming
  - Crimson Pro serif font for game text
  - IBM Plex Mono for commands
  - Refined dark color palette (charcoal + muted accents)
  - Comprehensive mobile responsive breakpoints (900px, 768px, 480px, landscape)
  - Touch-friendly button sizing
  - Active state for talk mode button

---

## Server Running

```bash
cd /e/Project/IFTalk && npm start
# Access at http://localhost:3000
```

---

## Git History

```
f8b5d5d WIP: ifvms-glkote flow with Parchment-compatible versions
41eff5b Update README with browser-based ZVM architecture
17f1d9e Replace Parchment with ifvms/ZVM + GlkOte
5d1850f Change default voices (THIS IS OUR FROTZ BASE)
12aa9d7 Initial commit: IFTalk voice-controlled IF player
```

Current branch: `frotz` (based on master, files from 5d1850f)
