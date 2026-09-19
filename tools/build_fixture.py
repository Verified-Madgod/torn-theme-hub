"""Build test/fixture.html from test/fixture.template.html.

- Inserts a <link> for every stylesheet in torn_css/ (numeric order).
- Stamps every ../src/ reference with the file's mtime (?v=...) so the browser
  never serves a stale theme or engine file while you iterate.

Usage:  python tools/build_fixture.py
Then serve the project root and open /test/fixture.html
  (?theme=<id>&dark=1&off=1 are supported in the URL).
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, 'test', 'fixture.template.html')
OUT = os.path.join(ROOT, 'test', 'fixture.html')
CSS_DIR = os.path.join(ROOT, 'torn_css')


def natural(s):
    return (not s[0].isdigit(), [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', s)])


def main():
    html = open(TPL, encoding='utf-8').read()
    files = sorted((f for f in os.listdir(CSS_DIR) if f.lower().endswith('.css')), key=natural)
    links = '\n'.join('<link rel="stylesheet" href="../torn_css/%s">' % f for f in files)
    html = html.replace('{{TORN_LINKS}}', links)

    def stamp(m):
        rel = m.group(2)
        path = os.path.join(ROOT, 'src', rel)
        v = int(os.path.getmtime(path)) if os.path.exists(path) else 0
        return '%s../src/%s?v=%d%s' % (m.group(1), rel, v, m.group(3))

    html = re.sub(r'((?:href|src)=")\.\./src/([^"?]+)(")', stamp, html)
    a = os.path.join(ROOT, 'test', 'audit.js')
    if os.path.exists(a):
        html = html.replace('src="audit.js"', 'src="audit.js?v=%d"' % int(os.path.getmtime(a)))
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('wrote %s  (%d Torn stylesheets)' % (OUT, len(files)))


if __name__ == '__main__':
    main()
