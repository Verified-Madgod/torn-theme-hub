# Firefox Add-ons (addons.mozilla.org) — listing copy

Submit at: https://addons.mozilla.org/developers/addon/submit/distribution
→ choose **"On this site"** → upload `dist/theme-hub-for-torn-<version>-firefox.xpi`.

When asked **"Do you use any of the following in your extension: code
generators, minifiers, transpilers, template engines, other tools?"** — answer
**No**. Everything shipped is hand-readable JS and CSS; the two generated CSS
files are plain CSS, not code (see reviewer notes below).

---

## Name
Theme Hub for Torn

## Add-on URL (slug)
theme-hub-for-torn

## Summary  (≤ 250 chars — this is 129)
23 colour themes for torn.com — Midnight, Nord, Dracula, Solarized, Paper and
more. Switch instantly from the toolbar, no reload.

## Description

Give Torn a new look. Theme Hub for Torn re-colours torn.com with one of 23
hand-tuned palettes and lets you switch between them from the toolbar, with no
page reload.

**Themes**
- Dark: Midnight, Obsidian, Nord, Dracula, Tokyo Night, Catppuccin Mocha,
  Rosé Pine, Gruvbox, Monokai, Solarized Dark, Synthwave 84, Cyberpunk, Matrix,
  Forest, Ocean Deep, Crimson, Coffee, Plum
- Light: Slate, Paper, Catppuccin Latte, Solarized Light, Mint

**Built to stay readable**
- Every theme is checked so text keeps at least 3:1 contrast against its
  background, in both Torn light and dark mode.
- Colours that carry meaning are left alone: money, energy/nerve/happy/life
  bars, status banners, errors and item rarity keep Torn's own colours.
- Jail, hospital and travel tints are kept by default so you can always tell
  your status at a glance (optional toggle to theme those too).

**Options**
- Hide Torn's decorative page backdrop
- Theme the chat panel (on/off)
- Tone down page images for darker themes

**Safe and rule-friendly**
- Makes **no network requests** of any kind, and sends nothing anywhere.
- Only restyles the torn.com page you're actively viewing. It doesn't read
  other pages or touch game actions.
- Works alongside TornTools.
- Leaves the Torn wiki untouched (it has its own design).

Not affiliated with or endorsed by Torn.

## Categories
- Appearance
- Games & Entertainment (if a second category is offered)

## Tags
torn, theme, dark mode, dark theme, color scheme

## Support
- Support site / email: optional — or leave blank and point to the Torn forum
  thread in the description once posted.

## License
Your choice. MIT is the usual pick for open, reusable code; "All Rights
Reserved" keeps copying restricted. (You must pick one on the form.)

## Privacy policy
Paste the contents of `PRIVACY.md`.

## Screenshots  (from `store/screenshots/`)
1. `1-picker.png` — caption: "Pick from 23 themes in the toolbar popup"
2. `2-gallery.png` — caption: "Dark and light palettes, all contrast-checked"
3. Recommended: 1–2 real Torn screenshots you take yourself (e.g. the forums
   in Midnight and Paper). **Crop or blur your name, money, and other players'
   names** before uploading.

---

## Notes to reviewer  (paste into "Notes for Reviewers")

This extension only injects CSS into torn.com and sets a small `<style>` element
with CSS custom properties chosen by the user. There is no background script and
no network code; `content.js` only reads `storage.local` and writes attributes
plus that `<style>` element.

`src/torn-vars.css` and `src/torn-rules.css` are plain, human-readable CSS
produced by a small Python script that maps grey colours in Torn's public
stylesheets onto the theme's palette. They contain no code, no `url()`s and no
remote references.

To test without a Torn account: install, open https://www.torn.com/ (the public
landing/login page is themed), and switch themes from the toolbar popup. A Torn account shows the full effect (sidebar, forums,
chat).
