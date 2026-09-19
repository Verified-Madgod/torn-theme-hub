/* Theme Hub for Torn - theme definitions.
 * Loaded both by the content script (as a plain global) and by the popup.
 * Everything in this file is just colour data. It touches no network, no DOM.
 *
 * NOTE ON THE VARIABLE PREFIX:
 * TornTools already owns the `--tt-*` custom-property namespace on torn.com
 * (you can see `--tt-theme-background` on <html> when it is installed), so
 * every property here uses `--thm-*` to stay out of its way.
 */

var TORN_THEME_TOKENS = [
  'bg',            // page background, behind every panel
  'header',        // top header bar
  'header-text',
  'sidebar',       // left navigation column
  'surface',       // main content panels (.cont-gray, post bodies)
  'surface-alt',   // inset areas: inputs, alternating rows, quotes
  'titlebar',      // the dark title strips above panels
  'titlebar-text',
  'text',
  'text-dim',
  'heading',
  'link',
  'link-hover',
  'accent',        // buttons, active states, progress fills
  'accent-text',   // text drawn on top of `accent`
  'border',
  'shadow',
  'scroll-thumb',
  'positive',      // money / gains - a green that is readable on this theme
  'negative'       // losses / money owed - a readable red
];

/* ---- contrast-safe semantic colours ------------------------------------
   Money is green because green MEANS money in Torn, so the hue is kept - but
   Torn's fixed green is too dark for some themes. tornThemeReadable() keeps
   the hue and walks the lightness until the colour reaches `min` contrast
   (WCAG) against every given background. */
function tornThemeHexRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function tornThemeLum(rgb) {
  var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function tornThemeContrast(a, b) {
  var la = tornThemeLum(a), lb = tornThemeLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function tornThemeHsl(h, s, l) {
  s /= 100; l /= 100;
  var k = function (n) { return (n + h / 30) % 12; };
  var a = s * Math.min(l, 1 - l);
  var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
  return [f(0), f(8), f(4)].map(function (v) { return Math.round(v * 255); });
}
function tornThemeReadable(hue, sat, dark, backgrounds, min) {
  var bgs = backgrounds.map(tornThemeHexRgb);
  // dark themes: brighten from a mid tone; light themes: darken from a mid tone
  for (var l = dark ? 45 : 42; dark ? l <= 92 : l >= 12; l += dark ? 1 : -1) {
    var rgb = tornThemeHsl(hue, sat, l);
    if (bgs.every(function (b) { return tornThemeContrast(rgb, b) >= min; })) {
      return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }
  }
  return dark ? '#9be7a0' : '#1f6b2a';   // unreachable for sane palettes
}

/* Expand a short palette into the full token set, filling sensible defaults. */
function tornThemeMake(name, scheme, p) {
  var dark = scheme === 'dark';
  var semanticBgs = [p.sidebar || p.bg2, p.surface, p.surfaceAlt || p.bg2];
  return {
    name: name,
    scheme: scheme,
    vars: {
      'bg':            p.bg,
      'header':        p.header || p.bg2,
      'header-text':   p.headerText || p.text,
      'sidebar':       p.sidebar || p.bg2,
      'surface':       p.surface,
      'surface-alt':   p.surfaceAlt || p.bg2,
      'titlebar':      p.titlebar || p.bg2,
      'titlebar-text': p.titleText || p.heading || p.text,
      'text':          p.text,
      'text-dim':      p.dim,
      'heading':       p.heading || p.text,
      'link':          p.link,
      'link-hover':    p.linkHover || p.accent,
      'accent':        p.accent,
      'accent-text':   p.accentText || '#ffffff',
      'border':        p.border,
      'shadow':        p.shadow || (dark ? 'rgba(0,0,0,.55)' : 'rgba(30,35,45,.16)'),
      'scroll-thumb':  p.scrollThumb || p.accent,
      'positive':      p.positive || tornThemeReadable(125, 60, dark, semanticBgs, 4.5),
      'negative':      p.negative || tornThemeReadable(4, 75, dark, semanticBgs, 4.5)
    }
  };
}

var TORN_THEMES = {

  /* ---------------------------- dark ---------------------------- */

  midnight: tornThemeMake('Midnight', 'dark', {
    bg: '#10131a', bg2: '#171b24', surface: '#1b202c', surfaceAlt: '#222839',
    text: '#c6cede', dim: '#7c869b', heading: '#e6ebf5',
    link: '#6fa8ff', accent: '#3b82f6', border: '#2a3141'
  }),

  obsidian: tornThemeMake('Obsidian', 'dark', {
    bg: '#0c0c0d', bg2: '#141416', surface: '#161618', surfaceAlt: '#1f1f22',
    text: '#d4d4d6', dim: '#82828a', heading: '#f2f2f4',
    link: '#9a9aff', accent: '#6b6bff', border: '#28282d'
  }),

  nord: tornThemeMake('Nord', 'dark', {
    bg: '#2e3440', bg2: '#3b4252', surface: '#3b4252', surfaceAlt: '#434c5e',
    text: '#d8dee9', dim: '#8f9bb0', heading: '#eceff4',
    link: '#88c0d0', accent: '#81a1c1', accentText: '#2e3440', border: '#4c566a'
  }),

  dracula: tornThemeMake('Dracula', 'dark', {
    bg: '#282a36', bg2: '#21222c', surface: '#2f313f', surfaceAlt: '#3a3d4d',
    text: '#f8f8f2', dim: '#9aa0b5', heading: '#ff79c6',
    link: '#8be9fd', accent: '#bd93f9', accentText: '#21222c', border: '#44475a'
  }),

  'tokyo-night': tornThemeMake('Tokyo Night', 'dark', {
    bg: '#1a1b26', bg2: '#16161e', surface: '#1f2335', surfaceAlt: '#272b3f',
    text: '#c0caf5', dim: '#787c99', heading: '#bb9af7',
    link: '#7aa2f7', accent: '#7aa2f7', accentText: '#16161e', border: '#2a2f45'
  }),

  'catppuccin-mocha': tornThemeMake('Catppuccin Mocha', 'dark', {
    bg: '#1e1e2e', bg2: '#181825', surface: '#252538', surfaceAlt: '#313244',
    text: '#cdd6f4', dim: '#9399b2', heading: '#f5c2e7',
    link: '#89b4fa', accent: '#cba6f7', accentText: '#1e1e2e', border: '#45475a'
  }),

  'rose-pine': tornThemeMake('Rose Pine', 'dark', {
    bg: '#191724', bg2: '#1f1d2e', surface: '#1f1d2e', surfaceAlt: '#26233a',
    text: '#e0def4', dim: '#908caa', heading: '#ebbcba',
    link: '#9ccfd8', accent: '#c4a7e7', accentText: '#191724', border: '#403d52'
  }),

  gruvbox: tornThemeMake('Gruvbox', 'dark', {
    bg: '#282828', bg2: '#1d2021', surface: '#32302f', surfaceAlt: '#3c3836',
    text: '#ebdbb2', dim: '#a89984', heading: '#fabd2f',
    link: '#83a598', accent: '#d79921', accentText: '#1d2021', border: '#504945'
  }),

  monokai: tornThemeMake('Monokai', 'dark', {
    bg: '#272822', bg2: '#1e1f1c', surface: '#2f3129', surfaceAlt: '#3a3c33',
    text: '#f8f8f2', dim: '#a6a28c', heading: '#a6e22e',
    link: '#66d9ef', accent: '#f92672', border: '#49483e'
  }),

  'solarized-dark': tornThemeMake('Solarized Dark', 'dark', {
    bg: '#002b36', bg2: '#073642', surface: '#073642', surfaceAlt: '#0b4553',
    text: '#93a1a1', dim: '#839496', heading: '#eee8d5',
    link: '#2aa198', accent: '#268bd2', border: '#12505f'
  }),

  synthwave: tornThemeMake('Synthwave 84', 'dark', {
    bg: '#241b2f', bg2: '#1a1226', surface: '#2a1f3d', surfaceAlt: '#34264a',
    text: '#f0e6ff', dim: '#9d8bb0', heading: '#ff7edb',
    link: '#36f9f6', accent: '#ff7edb', accentText: '#1a1226', border: '#46345f'
  }),

  cyberpunk: tornThemeMake('Cyberpunk', 'dark', {
    bg: '#0b0f14', bg2: '#05080b', surface: '#10161f', surfaceAlt: '#16202c',
    text: '#d7f7ff', dim: '#6f8a99', heading: '#fcee0a',
    link: '#00f0ff', accent: '#fcee0a', accentText: '#05080b', border: '#1d2a38'
  }),

  matrix: tornThemeMake('Matrix', 'dark', {
    bg: '#000a04', bg2: '#00160a', surface: '#021b0d', surfaceAlt: '#052913',
    text: '#9dffb8', dim: '#4f9a68', heading: '#39ff14',
    link: '#39ff14', accent: '#0f8a3c', border: '#0b3d1e'
  }),

  forest: tornThemeMake('Forest', 'dark', {
    bg: '#14201a', bg2: '#0e1813', surface: '#1a2a21', surfaceAlt: '#22362b',
    text: '#d4e6d8', dim: '#85a08e', heading: '#a3d9a5',
    link: '#7ec98f', accent: '#4c9a5c', border: '#274436'
  }),

  ocean: tornThemeMake('Ocean Deep', 'dark', {
    bg: '#0b1c2c', bg2: '#071523', surface: '#102a3f', surfaceAlt: '#17364f',
    text: '#cfe4f5', dim: '#7b9bb5', heading: '#8fd3ff',
    link: '#4fb3e8', accent: '#1f7fb8', border: '#1b405c'
  }),

  crimson: tornThemeMake('Crimson', 'dark', {
    bg: '#16090c', bg2: '#1e0c11', surface: '#241015', surfaceAlt: '#31161d',
    text: '#f0dadd', dim: '#ab8288', heading: '#ff6b81',
    link: '#ff8fa3', accent: '#c2223c', border: '#40202a'
  }),

  coffee: tornThemeMake('Coffee', 'dark', {
    bg: '#2b211a', bg2: '#211a14', surface: '#35281f', surfaceAlt: '#423227',
    text: '#e8d9c5', dim: '#a8907a', heading: '#d9a441',
    link: '#c98f5a', accent: '#8b5e34', border: '#4d3a2c'
  }),

  plum: tornThemeMake('Plum', 'dark', {
    bg: '#1b1220', bg2: '#150e19', surface: '#241730', surfaceAlt: '#2f1e3e',
    text: '#e9dcf2', dim: '#a38cb5', heading: '#d9a7ff',
    link: '#c08cf0', accent: '#8e44c9', border: '#3b2a4c'
  }),

  /* ---------------------------- light ---------------------------- */

  slate: tornThemeMake('Slate', 'light', {
    bg: '#eef1f5', bg2: '#e2e7ee', surface: '#ffffff', surfaceAlt: '#f2f5f9',
    text: '#33415c', dim: '#6b7a90', heading: '#1b2a41',
    link: '#2563eb', accent: '#2563eb', border: '#cfd8e3',
    shadow: 'rgba(27,42,65,.15)'
  }),

  paper: tornThemeMake('Paper', 'light', {
    bg: '#f7f3ec', bg2: '#efe9df', surface: '#fffdf8', surfaceAlt: '#f1ece3',
    text: '#4a4034', dim: '#8b7f6e', heading: '#2f271c',
    link: '#9a5b2e', accent: '#b4703a', border: '#ddd4c6',
    shadow: 'rgba(74,64,52,.15)'
  }),

  'catppuccin-latte': tornThemeMake('Catppuccin Latte', 'light', {
    bg: '#eff1f5', bg2: '#e6e9ef', surface: '#ffffff', surfaceAlt: '#e6e9ef',
    text: '#4c4f69', dim: '#6c6f85', heading: '#1e66f5',
    link: '#1e66f5', accent: '#8839ef', border: '#ccd0da',
    shadow: 'rgba(76,79,105,.18)'
  }),

  'solarized-light': tornThemeMake('Solarized Light', 'light', {
    bg: '#fdf6e3', bg2: '#eee8d5', surface: '#fdf6e3', surfaceAlt: '#eee8d5',
    text: '#586e75', dim: '#657b83', heading: '#073642',
    link: '#268bd2', accent: '#8a6800', accentText: '#fdf6e3',
    border: '#ded8c4', shadow: 'rgba(101,123,131,.22)'
  }),

  mint: tornThemeMake('Mint', 'light', {
    bg: '#eef6f2', bg2: '#e0ede7', surface: '#ffffff', surfaceAlt: '#eaf4ef',
    text: '#2f4a41', dim: '#6d8a80', heading: '#17352c',
    link: '#0f7a5f', accent: '#0b7d5f', border: '#cadfd6',
    shadow: 'rgba(23,53,44,.14)'
  })
};

/* Display order for the popup grid: dark block first, then light. */
var TORN_THEME_ORDER = [
  'midnight', 'obsidian', 'nord', 'dracula', 'tokyo-night', 'catppuccin-mocha',
  'rose-pine', 'gruvbox', 'monokai', 'solarized-dark', 'synthwave', 'cyberpunk',
  'matrix', 'forest', 'ocean', 'crimson', 'coffee', 'plum',
  'slate', 'paper', 'catppuccin-latte', 'solarized-light', 'mint'
];

/* CSS text declaring a theme's --thm-* tokens.
 *
 * The tokens live in their own <style> element rather than in <html style="">,
 * because other scripts write that attribute too - TornTools puts its
 * --tt-theme-* variables there - and a whole-attribute rewrite would silently
 * wipe every theme colour. `extra` adds more token/value pairs. */
function tornThemeCss(id, extra) {
  var t = TORN_THEMES[id];
  if (!t) return '';
  var vars = {}, k;
  for (k in t.vars) vars[k] = t.vars[k];
  if (extra) for (k in extra) vars[k] = extra[k];
  var lines = [];
  for (k in vars) lines.push('  --thm-' + k + ': ' + vars[k] + ' !important;');
  return 'html[data-thm] {\n' + lines.join('\n') + '\n}\n';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TORN_THEMES: TORN_THEMES,
    TORN_THEME_ORDER: TORN_THEME_ORDER,
    TORN_THEME_TOKENS: TORN_THEME_TOKENS,
    tornThemeCss: tornThemeCss
  };
}
