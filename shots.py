import sys, asyncio
from playwright.sync_api import sync_playwright
base = sys.argv[1]; out = sys.argv[2]; path = sys.argv[3] if len(sys.argv) > 3 else '/'
tag = sys.argv[4] if len(sys.argv) > 4 else 'home'
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h, mobile in [('desktop', 1440, 900, False), ('phone', 390, 844, True)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
        pg = ctx.new_page()
        pg.route("**/*", lambda r: r.abort() if any(x in r.request.url for x in ('fonts.googleapis','fonts.gstatic','ytimg','youtube','instagram')) else r.continue_())
        msgs = []
        pg.on('console', lambda m: msgs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: msgs.append(f'pageerror: {e}'))
        pg.goto(base + path, wait_until='load')
        pg.wait_for_timeout(1800)
        pg.screenshot(path=f'{out}/{tag}-{name}-fold.png')
        # scroll through so lazy content/observers fire, then full page
        H = pg.evaluate('document.documentElement.scrollHeight')
        for y in range(0, H, 600):
            pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(60)
        pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{out}/{tag}-{name}-full.png', full_page=True)
        ow = pg.evaluate('document.documentElement.scrollWidth')
        print(name, 'height', H, 'scrollWidth', ow, 'viewport', w, '| console:', msgs[:5])
        ctx.close()
    b.close()
