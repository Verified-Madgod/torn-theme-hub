"""Build store-ready packages into dist/.

    python tools/build_release.py

Produces
    dist/theme-hub-for-torn-<version>-firefox.xpi   -> addons.mozilla.org
    dist/theme-hub-for-torn-<version>-chrome.zip    -> Chrome Web Store / Edge Add-ons

The Chrome build drops `browser_specific_settings` (Firefox-only; Chrome warns
on unknown keys). Both packages contain only what the extension needs:
manifest, src/, icons/, README.md, PRIVACY.md. Dev folders (tools/, test/,
torn_css/, store/, dist/) are never shipped - torn_css/ in particular is Torn's
own CSS and must not be redistributed.

Before packaging, the build FAILS if any of these checks fail:
  - every file referenced by the manifest exists
  - manifest basics: name, version, description <= 132 chars, gecko id,
    strict_min_version, data_collection_permissions
  - JavaScript parses (node --check, when node is installed)
  - no network-capable API anywhere in shipped JS
  - no innerHTML / outerHTML / insertAdjacentHTML / document.write / eval
    (Mozilla's linter flags these; AMO may reject)
  - no url() or http(s):// anywhere in shipped CSS/JS (the extension must never
    be the origin of a request)
  - balanced braces in every shipped CSS file
"""
import json, os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
SHIP_DIRS = ['src', 'icons']
SHIP_FILES = ['manifest.json', 'README.md', 'PRIVACY.md']

NETWORK_RE = re.compile(r'\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|EventSource|new\s+Image\s*\(|importScripts')
# url( not directly inside a quoted attribute selector like [fill^="url("]
CSS_URL_RE = re.compile(r'(?<!")url\(')
HTTP_RE = re.compile(r'https?://')
# Mozilla's linter flags these as unsafe HTML injection -> AMO rejection risk
UNSAFE_HTML_RE = re.compile(r'\.(?:innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\s*\(')

errors = []


def fail(msg):
    errors.append(msg)


def shipped_files():
    out = [f for f in SHIP_FILES if os.path.exists(os.path.join(ROOT, f))]
    for d in SHIP_DIRS:
        for base, _, files in os.walk(os.path.join(ROOT, d)):
            for f in files:
                out.append(os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, '/'))
    return sorted(out)


def check(manifest, files):
    # manifest basics
    for key in ('name', 'version', 'description'):
        if not manifest.get(key):
            fail('manifest: missing %s' % key)
    if len(manifest.get('description', '')) > 132:
        fail('manifest: description is %d chars (Chrome max 132)' % len(manifest['description']))
    gecko = manifest.get('browser_specific_settings', {}).get('gecko', {})
    for key in ('id', 'strict_min_version', 'data_collection_permissions'):
        if key not in gecko:
            fail('manifest: gecko.%s missing' % key)

    # referenced files exist
    refs = []
    for cs in manifest.get('content_scripts', []):
        refs += cs.get('js', []) + cs.get('css', [])
    refs += list(manifest.get('icons', {}).values())
    refs += list(manifest.get('action', {}).get('default_icon', {}).values())
    if manifest.get('action', {}).get('default_popup'):
        refs.append(manifest['action']['default_popup'])
    for r in sorted(set(refs)):
        if r not in files:
            fail('manifest references missing file: %s' % r)

    node = shutil.which('node')
    for f in files:
        path = os.path.join(ROOT, f)
        if f.endswith('.js'):
            src = open(path, encoding='utf-8').read()
            code = re.sub(r'/\*.*?\*/|//[^\n]*', '', src, flags=re.S)   # comments may mention APIs
            if NETWORK_RE.search(code):
                fail('%s: network-capable API found' % f)
            if HTTP_RE.search(code):
                fail('%s: http(s) URL in code' % f)
            m = UNSAFE_HTML_RE.search(code)
            if m:
                fail('%s: unsafe HTML/code injection (%s)' % (f, m.group(0)))
            if node:
                r = subprocess.run([node, '--check', path], capture_output=True, text=True)
                if r.returncode:
                    fail('%s: syntax error\n%s' % (f, r.stderr.strip()))
        elif f.endswith('.css'):
            css = re.sub(r'/\*.*?\*/', '', open(path, encoding='utf-8').read(), flags=re.S)
            if CSS_URL_RE.search(css):
                fail('%s: url() found' % f)
            if HTTP_RE.search(css):
                fail('%s: http(s) URL found' % f)
            if css.count('{') != css.count('}'):
                fail('%s: unbalanced braces (%d/%d)' % (f, css.count('{'), css.count('}')))
        elif f.endswith('.html'):
            html = open(path, encoding='utf-8').read()
            if re.search(r'<script[^>]+src=["\']https?:', html) or re.search(r'<link[^>]+href=["\']https?:', html):
                fail('%s: loads a remote resource' % f)
    return node is not None


def write_zip(out, files, manifest):
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in files:
            if f == 'manifest.json':
                z.writestr('manifest.json', json.dumps(manifest, indent=2) + '\n')
            else:
                z.write(os.path.join(ROOT, f), f)
    with zipfile.ZipFile(out) as z:
        assert 'manifest.json' in z.namelist()


def main():
    manifest = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
    files = shipped_files()
    had_node = check(manifest, files)
    if errors:
        print('BUILD FAILED:')
        for e in errors:
            print('  -', e)
        sys.exit(1)

    os.makedirs(DIST, exist_ok=True)
    v = manifest['version']
    ff = os.path.join(DIST, 'theme-hub-for-torn-%s-firefox.xpi' % v)
    cr = os.path.join(DIST, 'theme-hub-for-torn-%s-chrome.zip' % v)

    write_zip(ff, files, manifest)
    chrome_manifest = {k: val for k, val in manifest.items() if k != 'browser_specific_settings'}
    write_zip(cr, files, chrome_manifest)

    print('checks passed (%d files%s)' % (len(files), '' if had_node else ', JS syntax NOT checked: node missing'))
    for p in (ff, cr):
        print('  %-52s %4d KB' % (os.path.relpath(p, ROOT), os.path.getsize(p) // 1024))


if __name__ == '__main__':
    main()
