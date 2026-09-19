/* Theme Hub for Torn - popup.
 * Writes settings to extension storage; the content script picks the change up
 * through storage.onChanged and repaints live. No messaging needed for that.
 */

(function () {
  'use strict';

  var api = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;

  var STORAGE_KEY = 'tornThemeHub';
  var DEFAULTS = {
    enabled: true,
    theme: 'midnight',
    hideBackdrop: true,
    themeChat: true,
    dimImages: 0,
    themeStatus: false
  };

  var state = Object.assign({}, DEFAULTS);
  var filterScheme = 'all';
  var filterText = '';

  var el = {
    enabled:      document.getElementById('enabled'),
    grid:         document.getElementById('grid'),
    search:       document.getElementById('search'),
    schemeFilter: document.getElementById('schemeFilter'),
    hideBackdrop: document.getElementById('hideBackdrop'),
    themeChat:    document.getElementById('themeChat'),
    themeStatus:  document.getElementById('themeStatus'),
    dimImages:    document.getElementById('dimImages'),
    dimValue:     document.getElementById('dimValue'),
    inspect:      document.getElementById('inspect'),
    status:       document.getElementById('status')
  };

  /* ---------------- storage ---------------- */

  function load() {
    return new Promise(function (resolve) {
      var r = api.storage.local.get(STORAGE_KEY);
      if (r && typeof r.then === 'function') {
        r.then(function (got) { resolve(got && got[STORAGE_KEY]); }, function () { resolve(null); });
      } else {
        api.storage.local.get(STORAGE_KEY, function (got) { resolve(got && got[STORAGE_KEY]); });
      }
    });
  }

  function save() {
    var payload = {};
    payload[STORAGE_KEY] = state;
    api.storage.local.set(payload);
  }

  /* ---------------- rendering ---------------- */

  /* Everything is built with createElement / textContent / style - never an
     HTML string - so nothing can ever be parsed as markup. */
  function node(tag, className, bg, parent) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (bg) n.style.background = bg;
    if (parent) parent.appendChild(n);
    return n;
  }

  function previewNode(theme) {
    var v = theme.vars;
    var preview = node('div', 'preview', v.bg);
    node('div', 'p-head', v.header, preview);
    node('div', 'p-side', v.sidebar, preview);
    var body = node('div', 'p-body', null, preview);
    node('div', 'p-title', v.titlebar, body);
    node('div', 'p-line', v['surface-alt'], body);
    node('div', 'p-line', v.link, body).style.opacity = '.85';
    node('div', 'p-line short', v.accent, body);
    return preview;
  }

  function render() {
    el.grid.replaceChildren();
    el.grid.classList.toggle('off', !state.enabled);

    var shown = 0;
    var needle = filterText.trim().toLowerCase();

    TORN_THEME_ORDER.forEach(function (id) {
      var theme = TORN_THEMES[id];
      if (!theme) return;
      if (filterScheme !== 'all' && theme.scheme !== filterScheme) return;
      if (needle && theme.name.toLowerCase().indexOf(needle) === -1 &&
                    id.indexOf(needle) === -1) return;

      shown++;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card' + (id === state.theme ? ' selected' : '');
      card.dataset.theme = id;
      card.title = theme.name;
      card.appendChild(previewNode(theme));
      var foot = node('div', 'card-foot', null, card);
      node('span', 'card-name', null, foot).textContent = theme.name;
      node('span', 'tag', null, foot).textContent = theme.scheme;

      card.addEventListener('click', function () {
        state.theme = id;
        if (!state.enabled) { state.enabled = true; el.enabled.checked = true; }
        save();
        render();
        flash(theme.name + ' applied');
      });

      el.grid.appendChild(card);
    });

    if (!shown) {
      var none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'No themes match that filter.';
      el.grid.appendChild(none);
    }
  }

  function syncControls() {
    el.enabled.checked      = !!state.enabled;
    el.hideBackdrop.checked = !!state.hideBackdrop;
    el.themeChat.checked    = !!state.themeChat;
    el.themeStatus.checked  = !!state.themeStatus;
    el.dimImages.value      = state.dimImages || 0;
    el.dimValue.textContent = (state.dimImages || 0) + '%';
  }

  var flashTimer;
  function flash(msg) {
    el.status.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.status.textContent = ''; }, 2200);
  }

  /* ---------------- events ---------------- */

  el.enabled.addEventListener('change', function () {
    state.enabled = el.enabled.checked;
    save();
    render();
    flash(state.enabled ? 'Theming on' : 'Theming off - Torn default restored');
  });

  el.hideBackdrop.addEventListener('change', function () {
    state.hideBackdrop = el.hideBackdrop.checked;
    save();
  });

  el.themeChat.addEventListener('change', function () {
    state.themeChat = el.themeChat.checked;
    save();
  });

  el.themeStatus.addEventListener('change', function () {
    state.themeStatus = el.themeStatus.checked;
    save();
  });

  el.dimImages.addEventListener('input', function () {
    state.dimImages = Number(el.dimImages.value);
    el.dimValue.textContent = state.dimImages + '%';
    save();
  });

  el.search.addEventListener('input', function () {
    filterText = el.search.value;
    render();
  });

  el.schemeFilter.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-scheme]');
    if (!btn) return;
    filterScheme = btn.dataset.scheme;
    Array.prototype.forEach.call(el.schemeFilter.children, function (b) {
      b.classList.toggle('on', b === btn);
    });
    render();
  });

  /* Palette inspector: asks the content script to read the CSS custom
     properties already present in the page's loaded stylesheets, and copies
     them to the clipboard. Useful for extending theme-engine.css. */
  el.inspect.addEventListener('click', function () {
    var q = api.tabs.query({ active: true, currentWindow: true });
    var handle = function (tabs) {
      if (!tabs || !tabs.length) { flash('No active tab'); return; }
      api.tabs.sendMessage(tabs[0].id, { type: 'thm:inspect' }, function (resp) {
        var err = api.runtime.lastError;
        if (err || !resp || !resp.ok) {
          flash('Open a torn.com tab first');
          return;
        }
        var text = JSON.stringify(resp.data, null, 2);
        navigator.clipboard.writeText(text).then(
          function () { flash(resp.data.count + ' vars copied to clipboard'); },
          function () { flash('Found ' + resp.data.count + ' vars (copy blocked)'); }
        );
      });
    };
    if (q && typeof q.then === 'function') { q.then(handle, function () { flash('No active tab'); }); }
    else { api.tabs.query({ active: true, currentWindow: true }, handle); }
  });

  /* ---------------- boot ---------------- */

  load().then(function (saved) {
    if (saved && typeof saved === 'object') {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (saved[k] !== undefined) state[k] = saved[k];
      });
    }
    syncControls();
    render();
  });
})();
