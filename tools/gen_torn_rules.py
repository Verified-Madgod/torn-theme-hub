"""Generate src/torn-rules.css: theme overrides for Torn's HARDCODED colours.

gen_torn_vars.py handles the ~370 colours Torn routes through CSS variables.
This handles the rest - the literal #hex / rgb() values written directly into
Torn's stylesheets (main.css alone has ~500 of them).

For every rule in torn_css/*.css, every colour-bearing declaration that contains
a NEUTRAL grey is re-emitted with that grey swapped for a theme token, under the
same selector prefixed with `html[data-thm]`. Selector order is preserved, so
Torn's own cascade (hover/active/state rules) still resolves the same way.

Why property matters
--------------------
A grey means different things depending on where it sits and which mode the
rule was written for. In a LIGHT-mode rule #f2f2f2 is a panel and #333 is text;
in a DARK-mode rule it is the other way round. And a #444 background in light
mode is a "dark island" (title bars, header) whose white text must stay paired
with it. So each colour is classified by (mode, property role, lightness):

  role  light-mode rule                       dark-mode rule (selector has .dark-mode)
  ----  ------------------------------------  ----------------------------------------
  bg    >=.93 surface  .85 surface-alt        ramp bg > surface > surface-alt > border
        .70 alt/border  .45 border            (light islands >.6 left alone)
        <.45 titlebar  (dark island)
  fg    <.25 text  ..  .75 text-dim           >.9 heading  .7 text  .45 text-dim
        >.8 titlebar-text (on dark island)    <.3 left alone (text on light chips)
  line  border  (white bevel lines -> faint)  border  (black bevel lines -> bg)
  shade dark -> --thm-shadow   light -> gone  dark -> --thm-shadow   light -> gone

Blue text/fill becomes --thm-link. All other saturated colours are untouched:
they carry meaning (money, status, rarity, errors).

Usage:  python tools/gen_torn_rules.py
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_torn_vars import (CSS_DIR, ROOT, COLOR_RE, MASK_RE, parse_color, hls,
                           is_neutral, is_blue, strip_comments, sub_colours)

OUT = os.path.join(ROOT, 'src', 'torn-rules.css')
# :not(#id) x2 adds ID-level weight so generated rules out-rank Torn's own
# selectors regardless of stylesheet order (no such ids exist; always matches)
PREFIX = 'html[data-thm]:not(#thm1):not(#thm2)'

# ------------------------------------------------------------------ roles

FG_PROPS = {'color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color',
            'text-decoration-color', 'column-rule-color'}
SHADOW_PROPS = {'box-shadow', 'text-shadow', '-webkit-box-shadow', 'filter'}


def role_of(prop):
    if prop in FG_PROPS:
        return 'fg'
    if prop.startswith('background'):
        return 'bg'
    if prop.startswith('border') or prop.startswith('outline'):
        return 'line'
    if prop in SHADOW_PROPS:
        return 'shade'
    return None

# ------------------------------------------------------------------ mapping


def v(t):
    return 'var(--thm-%s)' % t


def mix(a, b, pct_a):
    """pct_a% of token a, rest token b."""
    pct_a = max(0, min(100, round(pct_a)))
    if pct_a <= 3:
        return v(b)
    if pct_a >= 97:
        return v(a)
    return 'color-mix(in srgb, %s %d%%, %s)' % (v(a), pct_a, v(b))


def ramp(l, stops):
    """Piecewise-linear lookup over [(lightness, token), ...] sorted ascending."""
    if l <= stops[0][0]:
        return v(stops[0][1])
    for (l0, t0), (l1, t1) in zip(stops, stops[1:]):
        if l <= l1:
            return mix(t1, t0, (l - l0) / (l1 - l0) * 100)
    return v(stops[-1][1])


DARK_BG = [(0.00, 'bg'), (0.20, 'surface'), (0.27, 'surface-alt'), (0.40, 'border')]
DARK_FG = [(0.30, 'text-dim'), (0.60, 'text-dim'), (0.80, 'text'), (1.00, 'heading')]
LIGHT_BG = [(0.45, 'border'), (0.70, 'border'), (0.85, 'surface-alt'), (0.93, 'surface')]
LIGHT_FG = [(0.00, 'heading'), (0.25, 'text'), (0.50, 'text-dim'), (0.75, 'text-dim')]


def alpha(expr, a):
    if a >= 0.995:
        return expr
    if a <= 0.005:
        return 'transparent'
    return 'color-mix(in srgb, %s %d%%, transparent)' % (expr, round(a * 100))


def map_color(c, role, dark):
    """Return replacement CSS for colour c, or None to keep it."""
    r, g, b, a = c
    if not is_neutral(c):
        if role == 'fg' and is_blue(c):
            return alpha(v('link'), a)
        return None
    l = hls(c)[1]

    if role == 'bg':
        if dark:
            return None if l > 0.60 else alpha(ramp(l, DARK_BG), a)
        return alpha(v('titlebar') if l < 0.45 else ramp(l, LIGHT_BG), a)

    if role == 'fg':
        if dark:
            return None if l < 0.30 else alpha(ramp(l, DARK_FG), a)
        if l > 0.80:
            return alpha(v('titlebar-text'), a)
        return alpha(ramp(l, LIGHT_FG), a)

    if role == 'line':
        if dark and l < 0.10:
            return alpha(v('bg'), a)
        if not dark and l > 0.95:
            return alpha(v('border'), a * 0.4)
        return alpha(v('border'), a)

    if role == 'shade':
        if l >= 0.5:
            return 'transparent'
        return alpha(v('shadow'), a)
    return None

# ------------------------------------------------------------------ css walk


def walk(css):
    """Yield ('rule', at_stack, selector, body) preserving order and @-nesting."""
    def inner(s, stack):
        i, n = 0, len(s)
        while i < n:
            j = s.find('{', i)
            if j < 0:
                return
            head = ' '.join(s[i:j].split())
            # a stray ';' terminated at-statement (e.g. @import/@charset) before the brace
            if ';' in head:
                head = head.rsplit(';', 1)[1].strip()
            depth, k = 1, j + 1
            while k < n and depth:
                if s[k] == '{': depth += 1
                elif s[k] == '}': depth -= 1
                k += 1
            body = s[j + 1:k - 1]
            if head.startswith('@'):
                kw = head.split()[0].lower()
                if kw in ('@media', '@supports'):
                    yield from inner(body, stack + [head])
                # @keyframes, @font-face, @page ... skipped
            elif head:
                yield stack, head, body
            i = k
    yield from inner(css, [])


DECL_RE = re.compile(r'([\w-]+)\s*:\s*((?:[^;(]|\([^()]*(?:\([^()]*\)[^()]*)*\))+)(;|$)')


def prefix_selector(sel):
    out = []
    for part in split_selector_list(sel):
        p = part.strip()
        if not p:
            continue
        if re.match(r'^(html|:root)\b', p):
            p = re.sub(r'^(html|:root)', PREFIX, p, count=1)
        else:
            p = PREFIX + ' ' + p
        out.append(p)
    return ',\n'.join(out)


def split_selector_list(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    return parts


VAR_FILE_SELECTORS = {':root', ':root .dark-mode', ':root .r', ':root .r.dark-mode'}


def process(fname, stats):
    css = strip_comments(open(os.path.join(CSS_DIR, fname), encoding='utf-8', errors='replace').read())
    out = []
    for stack, sel, body in walk(css):
        if sel in VAR_FILE_SELECTORS or sel.startswith(':root .d[') or sel.startswith(':root .dark-mode['):
            continue                                   # variable blocks: gen_torn_vars.py
        dark = 'dark-mode' in sel
        new_decls = []
        # Torn often writes fallback chains in one rule:
        #   background: url(x.png); background: linear-gradient(...); background: var(--y);
        # Only the LAST declaration of a property is live. Re-emitting an earlier
        # one with !important would resurrect a fallback Torn deliberately
        # overrode, so keep just the last occurrence of each property.
        last = {}
        for m in DECL_RE.finditer(body):
            last[m.group(1).strip().lower()] = m
        stats['fallbacks_ignored'] += sum(1 for _ in DECL_RE.finditer(body)) - len(last)
        for m in sorted(last.values(), key=lambda x: x.start()):
            prop, val = m.group(1).strip().lower(), m.group(2).strip()
            if prop.startswith('--'):
                continue
            role = role_of(prop)
            if not role:
                continue
            important = False
            if val.lower().endswith('!important'):
                val = val[:-10].rstrip(); important = True
            # Never re-emit url(): the extension must not be the origin of any
            # request, even for an image Torn already loads. For a background
            # that carries an image, override only its colour layer.
            if 'url(' in val.lower():
                if role != 'bg' or prop not in ('background', 'background-color'):
                    stats['url_skipped'] += 1
                    continue
                outside = [c for c in (parse_color(t) for t in
                           COLOR_RE.findall(MASK_RE.sub(' ', val))) if c]
                mapped = [map_color(c, role, dark) for c in outside]
                mapped = [m_ for m_ in mapped if m_]
                if mapped:
                    new_decls.append('  background-color: %s !important;' % mapped[-1])
                    stats['decls'] += 1; stats['colours'] += 1
                else:
                    stats['url_skipped'] += 1
                continue

            changed = [0]

            def repl(cm):
                c = parse_color(cm.group(0))
                if c is None:
                    return cm.group(0)
                r = map_color(c, role, dark)
                if r is None:
                    return cm.group(0)
                changed[0] += 1
                return r

            nv = sub_colours(val, repl)
            if changed[0]:
                new_decls.append('  %s: %s !important;' % (prop, nv))
                stats['decls'] += 1
                stats['colours'] += changed[0]
        if new_decls:
            stats['rules'] += 1
            block = '%s {\n%s\n}' % (prefix_selector(sel), '\n'.join(new_decls))
            for at in reversed(stack):
                block = '%s {\n%s\n}' % (at, block)
            out.append(block)
    return out


def main():
    files = sorted((f for f in os.listdir(CSS_DIR) if f.lower().endswith('.css')),
                   key=lambda s: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', s)])
    stats = {'rules': 0, 'decls': 0, 'colours': 0, 'url_skipped': 0, 'fallbacks_ignored': 0}
    seen, chunks, per_file = set(), [], []
    for f in files:
        blocks_ = process(f, stats)
        fresh = [b for b in blocks_ if b not in seen]      # 14.css/16.css style duplicates
        seen.update(fresh)
        if fresh:
            chunks.append('/* ---- %s ---- */\n%s' % (f, '\n'.join(fresh)))
            per_file.append((f, len(fresh)))

    header = [
        '/* GENERATED by tools/gen_torn_rules.py - do not edit by hand.',
        ' * Theme overrides for colours hardcoded in Torn\'s stylesheets.',
        ' * %(rules)d rules, %(decls)d declarations, %(colours)d colours remapped.' % stats,
        ' * Scoped under html[data-thm]: inert until a theme is switched on. */',
        '',
    ]
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(header) + '\n'.join(chunks) + '\n')

    print('rules %(rules)d | declarations %(decls)d | colours %(colours)d | url decls skipped %(url_skipped)d | dead fallbacks ignored %(fallbacks_ignored)d' % stats)
    for f, n in per_file:
        print('  %-8s %d rules' % (f, n))
    print('wrote', OUT, '(%d KB)' % (os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
