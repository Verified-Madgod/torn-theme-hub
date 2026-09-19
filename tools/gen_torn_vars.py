"""Generate src/torn-vars.css from Torn's own variable stylesheets.

Torn routes most of its colours through ~500 CSS custom properties, declared in
light_mode/vars.css (on :root) and dark_mode/vars.css (on :root .dark-mode).
Rather than restyling every selector, this re-points those variables at the
Theme Hub palette (--thm-*), so every page that uses them follows the theme.

Usage:
    python tools/gen_torn_vars.py            # reads ./torn_css, writes ./src/torn-vars.css

Re-run it whenever you save a fresh copy of Torn's CSS into torn_css/.
File names in torn_css/ do not matter - files are identified by content.

How each variable is handled
----------------------------
Every colour literal inside the variable's DARK-mode value is examined (dark
mode is used as the reference because there, lightness maps cleanly onto role:
near-black = background, mid-grey = border, near-white = text).

  neutral grey  ->  remapped onto the theme ramp
                    bg -> surface -> surface-alt -> border -> text-dim -> text -> heading
                    alpha is preserved via color-mix(... , transparent)
  blue, in a variable named *blue*/*link*  ->  --thm-link
  anything else saturated  ->  kept exactly (it is semantic: money, status, rarity)

Variables are skipped entirely when they are:
  - a known semantic palette (BBCode colours, bg-N gradients, issue status, ...)
  - identical in light and dark mode AND not structural (e.g. --default-white-color
    is #fff in both because it is used as literal white on coloured buttons)
  - image URLs, sizes, or anything with no colour in it
"""
import colorsys, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_DIR = os.path.join(ROOT, 'torn_css')
OUT = os.path.join(ROOT, 'src', 'torn-vars.css')
BOOST = 'html[data-thm]:not(#thm1):not(#thm2)'   # ID-level weight; see gen_torn_rules.PREFIX

# ------------------------------------------------------------------ parsing

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def blocks(css, prefix=''):
    i, n = 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            return
        sel = ' '.join(css[i:j].split())
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        path = (prefix + ' >> ' + sel) if prefix else sel
        if '{' in body:
            yield from blocks(body, path)
        else:
            yield path, body
        i = k


def decls(body):
    return {m.group(1): ' '.join(m.group(2).split())
            for m in re.finditer(r'(--[\w-]+)\s*:\s*([^;]+);?', body)}


LIGHT_BASE = {':root'}
DARK_BASE = {':root .dark-mode'}
VARIANT_RE = re.compile(r'data-layout="(jail|hospital)"|data-abroad="true"')


def load_all():
    light, dark, variant_names, sources = {}, {}, set(), []
    for fname in sorted(os.listdir(CSS_DIR)):
        if not fname.lower().endswith('.css'):
            continue
        css = strip_comments(open(os.path.join(CSS_DIR, fname), encoding='utf-8', errors='replace').read())
        used = False
        for sel, body in blocks(css):
            d = decls(body)
            if not d:
                continue
            if sel in LIGHT_BASE:
                light.update(d); used = True
            elif sel in DARK_BASE:
                dark.update(d); used = True
            elif VARIANT_RE.search(sel):
                variant_names.update(d.keys())
        if used:
            sources.append(fname)
    return light, dark, variant_names, sources


def resolve(val, table, depth=0):
    if depth > 12 or val is None:
        return val
    def sub(m):
        name, fb = m.group(1), m.group(2)
        if name in table:
            return resolve(table[name], table, depth + 1)
        return fb.strip() if fb else m.group(0)
    return re.sub(r'var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)', sub, val)

# ------------------------------------------------------------------ colours

HEX_RE = r'#[0-9a-fA-F]{3,8}\b'
FUNC_RE = r'(?:rgba?|hsla?)\([^()]*\)'
NAMED = {'white': (255, 255, 255, 1.0), 'black': (0, 0, 0, 1.0)}
COLOR_RE = re.compile(r'(%s|%s|\b(?:white|black)\b)' % (HEX_RE, FUNC_RE))


def parse_color(tok):
    t = tok.strip().lower()
    if t in NAMED:
        return NAMED[t]
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        if len(h) not in (6, 8):
            return None
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = re.match(r'(rgba?|hsla?)\((.*)\)', t)
    if not m:
        return None
    parts = [p for p in re.split(r'[\s,/]+', m.group(2).strip()) if p]
    try:
        if m.group(1).startswith('rgb'):
            r, g, b = (float(p.rstrip('%')) * (2.55 if p.endswith('%') else 1) for p in parts[:3])
        else:
            hh = float(parts[0].rstrip('deg')) / 360
            ss = float(parts[1].rstrip('%')) / 100
            ll = float(parts[2].rstrip('%')) / 100
            r, g, b = (c * 255 for c in colorsys.hls_to_rgb(hh, ll, ss))
        a = 1.0
        if len(parts) > 3:
            a = float(parts[3].rstrip('%')) / (100 if parts[3].endswith('%') else 1)
        return r, g, b, a
    except (ValueError, IndexError):
        return None


MASK_RE = re.compile(r'url\([^)]*\)|var\(\s*--[\w-]+')


_SENT = chr(0xE000)   # private-use char: cannot occur in real CSS


def sub_colours(val, repl):
    """COLOR_RE.sub, but never inside url(...) or a var(--name).

    Without this, the named colour `white` matches inside
    `ajax-loader-white.gif` or `var(--title-white-gradient)` and corrupts them.
    """
    masks = []
    def hide(m):
        masks.append(m.group(0))
        return '%s%d%s' % (_SENT, len(masks) - 1, _SENT)
    out = COLOR_RE.sub(repl, MASK_RE.sub(hide, val))
    return re.sub(_SENT + r'(\d+)' + _SENT, lambda m: masks[int(m.group(1))], out)


def hls(c):
    return colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)


def is_neutral(c):
    return (max(c[:3]) - min(c[:3])) < 22          # chroma under ~9%


def is_blue(c):
    h, l, s = hls(c)
    return 0.50 <= h <= 0.66 and s > 0.30

# theme ramp, calibrated against Torn dark mode:
#   #000 page  #333 panel  #444 active panel  #666 border  #999 dim  #ccc text  #fff heading
RAMP = [(0.00, 'bg'), (0.20, 'surface'), (0.27, 'surface-alt'), (0.40, 'border'),
        (0.60, 'text-dim'), (0.80, 'text'), (1.00, 'heading')]


def ramp_expr(lightness):
    if lightness <= RAMP[0][0]:
        return 'var(--thm-%s)' % RAMP[0][1]
    for (l0, t0), (l1, t1) in zip(RAMP, RAMP[1:]):
        if lightness <= l1:
            p = round((lightness - l0) / (l1 - l0) * 100)
            if p <= 3:
                return 'var(--thm-%s)' % t0
            if p >= 97:
                return 'var(--thm-%s)' % t1
            return 'color-mix(in srgb, var(--thm-%s) %d%%, var(--thm-%s))' % (t1, p, t0)
    return 'var(--thm-%s)' % RAMP[-1][1]


def with_alpha(expr, a):
    if a >= 0.995:
        return expr
    if a <= 0.005:
        return 'transparent'
    return 'color-mix(in srgb, %s %d%%, transparent)' % (expr, round(a * 100))

# ------------------------------------------------------------------ policy

SEMANTIC_NAME = re.compile(
    r'^--(te-|default-base-|default-bg-\d+-gradient|issue-status|items-glow|'
    r'user-status|faction-tag|icon-stars|registration-gender|revive-availability|'
    r'early-discharge|default-(white|black)-color$|default-gray-f2-color$)')
STRUCTURAL_NAME = re.compile(
    r'(gradient|bg|background|border|divider|delimiter|shadow|title|tabs|panel|'
    r'cont|dropdown|tooltip|header|dialog|plate|popup|menu)')
BLUE_NAME = re.compile(r'(blue|link|focus)')


def transform(name, light_v, dark_v):
    """Return (css_value, reason) or (None, reason)."""
    if SEMANTIC_NAME.search(name):
        return None, 'semantic'
    ref = dark_v if dark_v is not None else light_v
    if not ref or 'url(' in ref:
        return None, 'no-colour'
    toks = COLOR_RE.findall(MASK_RE.sub(' ', ref))
    if not toks:
        return None, 'no-colour'
    differs = (light_v or '').replace(' ', '').lower() != (dark_v or '').replace(' ', '').lower()
    if not differs and not STRUCTURAL_NAME.search(name):
        return None, 'mode-invariant'

    changed = [0]
    blue_ok = bool(BLUE_NAME.search(name))

    def repl(m):
        c = parse_color(m.group(0))
        if c is None:
            return m.group(0)
        if is_neutral(c):
            changed[0] += 1
            return with_alpha(ramp_expr(hls(c)[1]), c[3])
        if blue_ok and is_blue(c):
            changed[0] += 1
            tok = 'accent' if 'focus' in name else 'link'
            return with_alpha('var(--thm-%s)' % tok, c[3])
        return m.group(0)

    out = sub_colours(ref, repl)
    if not changed[0]:
        return None, 'only-semantic-colours'
    return out, 'remapped'

# ------------------------------------------------------------------ main

def main():
    light, dark_raw, variant_names, sources = load_all()
    if not light or not dark_raw:
        sys.exit('Could not find both a `:root {` and a `:root .dark-mode {` var block in %s' % CSS_DIR)

    dark = dict(light); dark.update(dark_raw)
    names = sorted(set(light) | set(dark_raw))

    base, gated, stats = [], [], {}
    for n in names:
        lv = resolve(light.get(n), light) if n in light else None
        dv = resolve(dark.get(n), dark)
        val, why = transform(n, lv, dv)
        stats[why] = stats.get(why, 0) + 1
        if val is None:
            continue
        line = '  %s: %s !important;' % (n, val)
        (gated if n in variant_names else base).append(line)

    status_sel = ('%s[data-thm-status="theme"] body,\n'
                  '%s body:not([data-layout="jail"]):not([data-layout="hospital"]):not([data-abroad="true"])'
                  % (BOOST, BOOST))

    out = []
    out.append('/* GENERATED by tools/gen_torn_vars.py - do not edit by hand.')
    out.append(' * Source files (torn_css/): %s' % ', '.join(sources))
    out.append(' * %s' % ', '.join('%s: %d' % kv for kv in sorted(stats.items())))
    out.append(' *')
    out.append(' * Declared on <body> with !important because Torn declares its dark')
    out.append(' * variables on `:root .dark-mode` / `:root .r.dark-mode` (i.e. body),')
    out.append(' * which would otherwise beat anything set on <html>. */')
    out.append('')
    out.append('%s body {' % BOOST)
    out.extend(base)
    out.append('}')
    out.append('')
    out.append('/* Variables that Torn re-tints for jail / hospital / abroad. Those tints')
    out.append('   tell you your state, so by default they are left alone in those states.')
    out.append('   The popup can switch this to "theme" to override them too. */')
    out.append(status_sel + ' {')
    out.extend(gated)
    out.append('}')
    out.append('')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out))

    print('sources  :', ', '.join(sources))
    print('variables:', len(names))
    for k, v in sorted(stats.items(), key=lambda kv: -kv[1]):
        print('  %-24s %d' % (k, v))
    print('wrote    : %s  (%d base + %d status-gated)' % (OUT, len(base), len(gated)))


if __name__ == '__main__':
    main()
