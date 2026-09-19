# Chrome Web Store — listing copy
_(Edge Add-ons uses the same answers; its form is nearly identical and free.)_

Developer console: https://chrome.google.com/webstore/devconsole
One-time $5 registration fee. Upload `dist/theme-hub-for-torn-<version>-chrome.zip`
(not the Firefox file — the Chrome build omits Firefox-only manifest keys).

---

## Store listing tab

**Name** — Theme Hub for Torn  _(taken from the manifest)_

**Summary** — taken from the manifest `description` (93 chars):
> 23 colour themes for torn.com. Pick one from the toolbar and it applies instantly, no reload.

**Description** — use the Firefox description in `LISTING-firefox.md` as-is.

**Category** — **Make Chrome Yours → Functionality & UI**
(alternative: Lifestyle → Games). Don't use Chrome's "Themes" section — that
is for browser themes, not extensions.

**Language** — English

**Graphics** (from `store/screenshots/`)
| Asset | File | Required |
|---|---|---|
| Store icon 128×128 | `icons/icon-128.png` | yes |
| Screenshot 1280×800 | `1-picker.png`, `2-gallery.png` | at least 1 |
| Small promo tile 440×280 | `promo-440x280.png` | yes |
| Marquee promo tile 1400×560 | `marquee-1400x560.png` | optional (used if Chrome features the extension) |
| Extra screenshot | `3-home.png` (personal numbers blurred) | optional |

Same advice as Firefox: add a real Torn screenshot or two, with your name,
money and other players' names cropped or blurred.

---

## Privacy practices tab

**Single purpose description**
> Restyles torn.com with a user-selected colour theme. The extension applies CSS to Torn pages the user is viewing and stores which theme was chosen.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's selected theme and display options (e.g. hide backdrop, theme chat) locally so they persist between visits. |
| Host permission `*://*.torn.com/*` | Required to apply the theme's CSS stylesheets to torn.com pages. The extension runs only on torn.com and only changes colours on the page being viewed. |

**Are you using remote code?** → **No, I am not using remote code.**
(All JS and CSS ship inside the package; nothing is fetched or evaluated at runtime.)

**Data usage** — tick **none** of the data-type boxes (the extension collects
none of: personally identifiable info, health, financial, authentication,
personal communications, location, web history, user activity, website
content).

Then tick all three certifications:
- I do not sell or transfer user data to third parties…
- I do not use or transfer user data for purposes unrelated to the item's single purpose
- I do not use or transfer user data to determine creditworthiness…

**Privacy policy URL** — Chrome only requires one if you handle user data (you
don't). If the form insists, host `PRIVACY.md` somewhere public (e.g. a GitHub
repo or gist) and paste that URL.

---

## Distribution tab
- Visibility: **Public** (or **Unlisted** for a soft launch — only people with
  the link can install).
- Regions: all.
