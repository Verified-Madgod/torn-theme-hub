/* Theme Hub for Torn - content script.
 *
 * What this does: reads your saved theme choice from extension storage, writes
 * the palette as --thm-* custom properties into its own <style id="thm-vars">,
 * and sets data-thm* flags on <html>. The CSS files do the rest.
 *
 * What this does NOT do, on purpose (Torn scripting rules):
 *   - no fetch / XHR / WebSocket / beacon of any kind
 *   - no reading of pages you are not looking at
 *   - no sending anything off your machine
 * The only I/O is browser.storage.local, which never leaves the browser.
 */

(function () {
  'use strict';

  var api = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;

  var STORAGE_KEY = 'tornThemeHub';

  var DEFAULTS = {
    enabled: true,
    theme: 'midnight',
    hideBackdrop: true,  // Torn's decorative page backdrop fights custom palettes
    themeChat: true,
    dimImages: 0,        // 0-40, percentage of desaturation applied to page images
    themeStatus: false   // false = keep Torn's jail/hospital/travel tints (they tell you your state)
  };

  function getState() {
    return new Promise(function (resolve) {
      try {
        var r = api.storage.local.get(STORAGE_KEY);
        if (r && typeof r.then === 'function') {
          r.then(function (got) { resolve(merge(got && got[STORAGE_KEY])); },
                 function () { resolve(Object.assign({}, DEFAULTS)); });
        } else {
          api.storage.local.get(STORAGE_KEY, function (got) {
            resolve(merge(got && got[STORAGE_KEY]));
          });
        }
      } catch (e) {
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  function merge(saved) {
    var out = Object.assign({}, DEFAULTS);
    if (saved && typeof saved === 'object') {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (saved[k] !== undefined) out[k] = saved[k];
      });
    }
    return out;
  }

  /* The palette is written into our own <style id="thm-vars">, NOT into
     <html style="">: TornTools (and potentially Torn) write that attribute too,
     and a whole-attribute rewrite after we ran would wipe every theme colour. */
  var STYLE_ID = 'thm-vars';
  var ATTRS = ['data-thm', 'data-thm-scheme', 'data-thm-backdrop', 'data-thm-chat',
               'data-thm-dim', 'data-thm-status'];
  var current = null;            // { attrs: {...}, css: '...' } while a theme is on

  function varsElement(create) {
    var el = document.getElementById(STYLE_ID);
    if (!el && create) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      // lets a console check confirm which build is actually running on the page
      try { el.dataset.version = api.runtime.getManifest().version; } catch (e) { /* test stub */ }
      // documentElement always exists at document_start; <head> may not yet
      (document.head || document.documentElement).appendChild(el);
      // watch whichever element now holds it, so a removal is noticed
      // (not <html> itself: re-observing a node REPLACES its options and would
      //  drop the attribute watch set up below - <html> already has childList)
      if (el.parentNode !== document.documentElement) guard.observe(el.parentNode, { childList: true });
    }
    return el;
  }

  function write() {
    var root = document.documentElement;
    if (!root || !current) return;
    var el = varsElement(true);
    if (el.textContent !== current.css) el.textContent = current.css;
    Object.keys(current.attrs).forEach(function (a) {
      if (root.getAttribute(a) !== current.attrs[a]) root.setAttribute(a, current.attrs[a]);
    });
  }

  /* The Torn wiki is a separate MediaWiki site with its own stylesheet; Torn
     rules applied there wreck it. The manifest already excludes wiki.torn.com;
     this also catches a MediaWiki page served from any other Torn address. */
  function excludedDocument() {
    if (location.hostname === 'wiki.torn.com') return true;
    return !!(document.body && document.body.classList.contains('mediawiki'));
  }

  function apply(state) {
    var root = document.documentElement;
    if (!root) return;

    var theme = TORN_THEMES[state.theme];

    if (!state.enabled || !theme || excludedDocument()) {
      current = null;
      ATTRS.forEach(function (a) { root.removeAttribute(a); });
      var el = varsElement(false);
      if (el) el.remove();
      return;
    }

    var sat = Math.max(0, Math.min(40, Number(state.dimImages) || 0));
    var extra = {};
    if (sat) extra['img-filter'] = 'saturate(' + (100 - sat) + '%) brightness(' + (100 - sat / 3).toFixed(1) + '%)';

    current = {
      css: tornThemeCss(state.theme, extra),
      attrs: {
        'data-thm': state.theme,
        'data-thm-scheme': theme.scheme,
        'data-thm-backdrop': state.hideBackdrop ? 'hidden' : 'shown',
        'data-thm-chat': state.themeChat ? 'on' : 'off',
        'data-thm-dim': sat ? 'on' : 'off',
        'data-thm-status': state.themeStatus ? 'theme' : 'keep'
      }
    };
    write();
  }

  /* Self-heal: if another script strips our attributes from <html> or removes
     our <style>, put them back - but NEVER fight about it.

     v1.3.0-1.4.2 re-applied unconditionally. Against another script that
     removes what we add, that became an endless microtask ping-pong: a pinned
     CPU core, a frozen tab and a crawling browser. So now:
       1. do nothing unless something is actually missing (our own writes
          also fire this observer, and those must not count as damage), and
       2. a circuit breaker: more than HEAL_LIMIT repairs inside HEAL_WINDOW_MS
          means something is fighting us - stop observing for good on this page
          and leave the page as it is. */
  var HEAL_LIMIT = 5;
  var HEAL_WINDOW_MS = 10000;
  var heals = [];
  var gaveUp = false;

  function damaged() {
    var root = document.documentElement;
    var el = document.getElementById(STYLE_ID);
    if (!el || el.textContent !== current.css) return true;
    return Object.keys(current.attrs).some(function (a) {
      return root.getAttribute(a) !== current.attrs[a];
    });
  }

  var guard = new MutationObserver(function () {
    if (!current || gaveUp) return;
    // <body> is a direct child of <html>, so this fires the moment it is
    // parsed - early enough to switch off on a wiki page before it paints.
    if (excludedDocument()) { apply({ enabled: false }); return; }
    if (!damaged()) return;                      // our own echo, or harmless

    var now = Date.now();
    heals = heals.filter(function (t) { return now - t < HEAL_WINDOW_MS; });
    if (heals.length >= HEAL_LIMIT) {
      gaveUp = true;
      guard.disconnect();
      console.warn('[Theme Hub for Torn] Another script keeps removing the theme from this ' +
        'page; stopped re-applying it to avoid a loop. Reload the page to try again.');
      return;
    }
    heals.push(now);
    write();
  });
  // <html>'s own attributes + direct children only - never the whole page,
  // so Torn's constant chat/DOM updates do not wake this up.
  guard.observe(document.documentElement, { attributes: true, attributeFilter: ATTRS, childList: true });

  getState().then(apply);

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    apply(merge(changes[STORAGE_KEY].newValue));
  });

  /* --------------------------------------------------------------------
   * Palette inspector (popup -> "Inspect page palette").
   *
   * Reads CSS custom properties out of the stylesheets THIS PAGE has already
   * loaded and are sitting in memory. No request is made; this is the same
   * information devtools shows you. Used to find Torn variable names worth
   * adding to theme-engine.css.
   * ------------------------------------------------------------------ */
  function collectCustomProps() {
    var found = Object.create(null);
    var sheets = document.styleSheets;

    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try {
        rules = sheets[i].cssRules;   // throws on cross-origin sheets; skip those
      } catch (e) {
        continue;
      }
      if (!rules) continue;

      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (!rule || rule.type !== 1 || !rule.style) continue;   // style rules only
        for (var k = 0; k < rule.style.length; k++) {
          var name = rule.style[k];
          if (name.slice(0, 2) !== '--') continue;
          if (name.slice(0, 6) === '--thm-') continue;           // ours
          if (found[name]) continue;
          found[name] = {
            value: rule.style.getPropertyValue(name).trim(),
            selector: rule.selectorText || ''
          };
        }
      }
    }

    var list = Object.keys(found).sort().map(function (n) {
      return { name: n, value: found[n].value, selector: found[n].selector };
    });
    return { url: location.pathname, count: list.length, vars: list };
  }

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'thm:inspect') return;
    try {
      sendResponse({ ok: true, data: collectCustomProps() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  });
})();
