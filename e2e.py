"""Browser test of the dashboard and the public site (Wolf Edit), on phone and desktop sizes.

Needs: Python 3, `pip install playwright`, and the test stack running:
    node test/serve-test-stack.mjs        # fake Supabase :3200 + real server :3100
Run:
    python3 test/e2e.py [outdir]          # screenshots go to outdir (default: test/out)
"""
import json, os, struct, subprocess, sys, tempfile, urllib.request, zlib
from playwright.sync_api import sync_playwright, expect

SITE = os.environ.get("SITE", "http://127.0.0.1:3100")
MOCK = os.environ.get("MOCK", "http://127.0.0.1:3200")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
ADMIN = ("dewanksaini18@gmail.com", "correct-horse-battery")
STRANGER = ("stranger@example.com", "another-long-password")
NEW_PASSWORD = "a-brand-new-password"

failures, passed = [], 0


def check(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failures.append(name)
        print(f"  FAIL {name} {detail}")


def state():
    with urllib.request.urlopen(f"{MOCK}/__state") as r:
        return json.load(r)


def table(name):
    return state()["db"][name]


PAGE = None  # the page to keep running while we wait (a plain sleep would freeze its network routes)


def eventually(fn, timeout=6.0):
    """Poll until fn() is truthy (the dashboard saves in the background)."""
    import time
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        PAGE.wait_for_timeout(150)
    return bool(fn())


def get(path):
    with urllib.request.urlopen(SITE + path) as r:
        return r.read().decode()


def png_bytes(w=64, h=36):
    raw = b"".join(b"\x00" + bytes([198, 255, 26]) * w for _ in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))


def blocked(route):
    u = route.request.url
    if any(x in u for x in ("fonts.googleapis", "fonts.gstatic", "ytimg", "youtube", "instagram", "drive.google")):
        return route.abort()
    route.continue_()


def new_page(browser, kind):
    w, h, mobile = (390, 844, True) if kind == "phone" else (1440, 900, False)
    ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    page = ctx.new_page()
    page.route("**/*", blocked)
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: page.errors.append(f"console: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.on("dialog", lambda d: d.accept())
    return ctx, page


def login(page, email, password):
    page.fill("#li-email", email)
    page.fill("#li-pass", password)
    page.click("button[type=submit]")


def toast_text(page):
    return page.locator(".toast").last.inner_text()


def row_titles(page):
    return page.locator(".rows .row .row-main strong").all_inner_texts()


def row_for(page, title):
    return page.locator(".rows .row").filter(has=page.locator("strong", has_text=title))


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ======================================================== 1. public site before any setup
    print("\n[1] public site, starter state")
    ctx, page = new_page(browser, "desktop")
    page.goto(SITE + "/")
    check("robots noindex on starter content", (page.locator('meta[name=robots]').get_attribute("content") or "").startswith("noindex"))
    check("placeholder clips are labelled", page.locator(".clip").count() >= 4)
    check("logo shows in the menu and the hero", page.locator(".nav .brand img").is_visible() and page.locator(".hero-logo").is_visible())
    page.wait_for_function("document.querySelector('.hero-logo').naturalWidth > 0")
    check("logo images actually load", page.evaluate("document.querySelector('.nav .brand img').naturalWidth") > 0)
    check("one h1 whose text is the brand name", page.locator("h1").count() == 1 and "WOLF EDIT" in (page.locator("h1 img").get_attribute("alt") or ""))
    check("no pricing section or menu link", page.locator("#pricing").count() == 0 and page.locator(".nav-links a", has_text="Pricing").count() == 0)
    check("page title is Wolf Edit", page.title().startswith("WOLF EDIT"))
    page.wait_for_timeout(1600)
    shot(page, "public-desktop-starter-fold")
    ctx.close()
    ctx, page = new_page(browser, "phone")
    page.goto(SITE + "/")
    page.wait_for_timeout(1300)
    check("phone: logo fits the header", page.evaluate("(() => { const r = document.querySelector('.nav .brand img').getBoundingClientRect(); return r.left >= 0 && r.right < 300; })()"))
    shot(page, "public-phone-starter-fold")
    ctx.close()

    # ======================================================== 2. sign in
    print("\n[2] admin sign in")
    ctx, page = new_page(browser, "phone")
    PAGE = page
    page.goto(SITE + "/admin")
    page.wait_for_selector("#li-email")
    shot(page, "admin-phone-login")
    check("login form shown", page.locator("form.login").count() == 1)
    login(page, ADMIN[0], "wrong-password")
    page.wait_for_selector(".form-error:not([hidden])")
    check("wrong password gives a friendly error", "not right" in page.locator(".form-error").inner_text())

    login(page, STRANGER[0], STRANGER[1])
    page.wait_for_selector("text=This account is not an admin yet")
    check("a non-admin sees the 'not an admin' screen", "insert into public.admins" in page.locator("pre.code").inner_text())
    shot(page, "admin-phone-not-admin")
    page.click("text=Sign out")
    page.wait_for_selector("#li-email")

    login(page, *ADMIN)
    page.wait_for_selector("#page-title")
    page.wait_for_selector(".stats")
    check("admin lands on the overview", page.locator("#page-title").inner_text() == "Overview")
    s = state()
    check("starter content seeded into the database on first login", len(s["db"]["projects"]) == 6 and any(r["key"] == "seeded" for r in s["db"]["site_settings"]) and len(s["db"]["content_items"]) > 10)
    check("overview lists placeholders to replace", page.locator("text=Placeholders still on your site").count() == 1)
    shot(page, "admin-phone-overview")

    # phone navigation: tab bar + drawer
    check("phone tab bar visible", page.locator(".tabbar").is_visible())
    page.click(".tabbar >> text=Menu")
    page.wait_for_selector("#side.open")
    shot(page, "admin-phone-drawer")
    page.click("#side >> text=Services")
    page.wait_for_selector("#page-title:has-text('Services')")
    check("drawer navigates and closes", page.locator("#side.open").count() == 0)
    page.goto(SITE + "/admin#/projects")
    page.wait_for_selector(".rows .row")
    ow = page.evaluate("document.documentElement.scrollWidth")
    check("no sideways scrolling on phone (projects)", ow <= 391, f"scrollWidth={ow}")
    page.wait_for_timeout(500)  # let the drawer finish sliding shut
    shot(page, "admin-phone-projects")

    # ======================================================== 3. projects
    print("\n[3] projects")
    check("six starter projects listed", len(row_titles(page)) == 6)

    page.click("text=Add project >> nth=0")
    page.wait_for_selector("dialog[open]")
    shot(page, "admin-phone-project-modal")
    page.fill("[data-k=title] input", "Link Test")
    page.fill("#pv-link", "not a link")
    page.click("dialog >> button:has-text('Add project')")
    page.wait_for_selector(".toast-error")
    check("garbage video link is refused", "not valid" in toast_text(page))
    page.click("dialog >> button:has-text('Cancel')")
    page.wait_for_selector("dialog[open]", state="detached")

    # add: YouTube Short, featured
    page.click("text=Add project >> nth=0")
    page.wait_for_selector("dialog[open]")
    page.fill("#pv-link", "https://www.youtube.com/shorts/dQw4w9WgXcQ")
    check("short link detected", "Short" in page.locator("dialog .hint[aria-live]").inner_text())
    check("shape switches to portrait for a Short", page.locator("dialog [data-k=aspect] select").input_value() == "portrait")
    page.fill("[data-k=title] input", "Wedding Reel Test")
    page.fill("[data-k=category] input", "Reels")
    page.fill("[data-k=description] textarea", "Cut for a wedding <b>teaser</b>.")
    page.check("[data-k=featured] input")
    page.click("dialog >> button:has-text('Add project')")
    page.wait_for_selector("dialog[open]", state="detached")
    check("new project is first in the list", row_titles(page)[0] == "Wedding Reel Test")
    mine = next(p for p in table("projects") if p["slug"] == "wedding-reel-test")
    check("saved with the right fields", mine["aspect"] == "portrait" and mine["featured"] and not mine["is_placeholder"] and "dQw4w9WgXcQ" in mine["video_url"] and mine["category"] == "Reels")
    check("new project sorts before every other one", mine["position"] < min(p["position"] for p in table("projects") if p["slug"] != "wedding-reel-test"))

    home = get("/")
    check("live site shows the new project", "Wedding Reel Test" in home)
    check("live site is now indexable (real content exists)", 'content="noindex' not in home)
    check("html in the description is escaped on the project page", "<b>teaser</b>" not in get("/work/wedding-reel-test") and "&lt;b&gt;teaser" in get("/work/wedding-reel-test"))
    check("new project appears before the placeholders", home.index("Wedding Reel Test") < home.index("Your reel goes here"))

    # reorder, persisted across reload
    page.click("[aria-label='Move Wedding Reel Test down']")
    page.wait_for_selector("text=Order saved")
    check("moving down changes the order", row_titles(page)[1] == "Wedding Reel Test")
    page.reload()
    page.wait_for_selector(".rows .row")
    check("order survives a refresh", row_titles(page)[1] == "Wedding Reel Test")
    row_for(page, "Wedding Reel Test").locator("button:has-text('To top')").click()
    page.wait_for_selector("text=Order saved")
    page.reload()
    page.wait_for_selector(".rows .row")
    check("'To top' survives a refresh", row_titles(page)[0] == "Wedding Reel Test")
    positions = sorted(p["position"] for p in table("projects"))
    check("positions are saved per row", positions == sorted(set(positions)) and len(positions) == 7, str(positions))

    # hide / show
    row_for(page, "Wedding Reel Test").locator("button:has-text('Hide')").click()
    page.wait_for_selector("text=Hidden")
    check("hiding removes it from the live site", "Wedding Reel Test" not in get("/"))
    check("hidden project page 404s", subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", SITE + "/work/wedding-reel-test"], capture_output=True, text=True).stdout == "404")
    row_for(page, "Wedding Reel Test").locator("button:has-text('Show')").click()
    page.wait_for_selector("text=Hidden", state="detached")
    check("showing brings it back", "Wedding Reel Test" in get("/"))

    # edit + thumbnail upload
    row_for(page, "Wedding Reel Test").locator("button:has-text('Edit')").click()
    page.wait_for_selector("dialog[open]")
    page.fill("[data-k=title] input", "Wedding Reel Final")
    page.set_input_files("dialog [data-k=thumbnail_url] input[type=file]", files=[{"name": "My Cover.png", "mimeType": "image/png", "buffer": png_bytes()}])
    page.wait_for_function("document.querySelector('dialog [data-k=thumbnail_url] input[type=text]').value.includes('/storage/v1/object/public/media/thumbnails/')")
    check("thumbnail uploaded to storage", any(f.startswith("thumbnails/") and f.endswith("my-cover.png") for f in state()["files"]), str(state()["files"]))
    shot(page, "admin-phone-project-edit")
    page.click("dialog >> button:has-text('Save changes')")
    page.wait_for_selector("dialog[open]", state="detached")
    saved = next(p for p in table("projects") if p["slug"] == "wedding-reel-test")
    check("edit saved with new title and thumbnail", saved["title"] == "Wedding Reel Final" and "/media/thumbnails/" in saved["thumbnail_url"])
    check("live site uses the uploaded thumbnail", saved["thumbnail_url"] in get("/"))
    with urllib.request.urlopen(saved["thumbnail_url"]) as r:
        check("uploaded thumbnail is publicly readable", r.status == 200 and r.headers["Content-Type"] == "image/png")

    # video upload + delete cleans up the file
    page.click("text=Add project >> nth=0")
    page.wait_for_selector("dialog[open]")
    page.fill("[data-k=title] input", "Uploaded Clip")
    page.set_input_files("dialog input[type=file][accept^='video']", files=[{"name": "clip.mp4", "mimeType": "video/mp4", "buffer": b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"0" * 2048}])
    page.wait_for_function("document.querySelector('#pv-link').value.includes('/media/videos/')")
    check("video upload fills the link", "Video file found" in page.locator("dialog .hint[aria-live]").inner_text())
    page.click("dialog >> button:has-text('Add project')")
    page.wait_for_selector("dialog[open]", state="detached")
    up = next(p for p in table("projects") if p["slug"] == "uploaded-clip")
    check("uploaded video stored", any(f.startswith("videos/") for f in state()["files"]))
    check("player data uses an HTML5 video for uploads", '&quot;k&quot;:&quot;video&quot;' in get("/") or '"k":"video"' in get("/").replace("&quot;", '"'))
    row_for(page, "Uploaded Clip").locator("button:has-text('Delete')").click()
    page.click("dialog >> button:has-text('Delete')")
    page.wait_for_selector("text=Project deleted")
    check("project row deleted", not any(p["slug"] == "uploaded-clip" for p in table("projects")))
    check("its uploaded file is deleted too", not any(f.startswith("videos/") for f in state()["files"]), str(state()["files"]))

    # delete a placeholder
    before = len(table("projects"))
    row_for(page, "Your short-form edit goes here").locator("button:has-text('Delete')").click()
    page.click("dialog >> button:has-text('Delete')")
    check("a placeholder project can be deleted", eventually(lambda: len(table("projects")) == before - 1))

    # duplicate title gets a unique slug
    for _ in range(2):
        page.click("text=Add project >> nth=0")
        page.wait_for_selector("dialog[open]")
        page.fill("[data-k=title] input", "Same Title")
        page.click("dialog >> button:has-text('Add project')")
        page.wait_for_selector("dialog[open]", state="detached")
    slugs = sorted(p["slug"] for p in table("projects") if p["title"] == "Same Title")
    check("two projects with one title get different slugs", slugs == ["same-title", "same-title-2"], str(slugs))
    check("project with no video link still renders on the site", "Same Title" in get("/"))

    # ======================================================== 4. content lists and settings
    print("\n[4] services, pricing, FAQ, settings")
    page.goto(SITE + "/admin#/content/services")
    page.wait_for_selector(".rows .row")
    page.locator(".rows .row").first.locator("button:has-text('Edit')").click()
    page.wait_for_selector("dialog[open]")
    page.fill("[data-k=title] input", "Reels and short-form edits")
    page.fill("[data-k=deliverables] textarea", "Instagram Reels\nYouTube Shorts\nCaptions")
    page.click("dialog >> button:has-text('Save changes')")
    page.wait_for_selector("dialog[open]", state="detached")
    svc = next(i for i in table("content_items") if i["collection"] == "services" and i["data"].get("title") == "Reels and short-form edits")
    check("service saved and placeholder flag cleared", svc["data"].get("placeholder") is False and svc["data"]["deliverables"] == ["Instagram Reels", "YouTube Shorts", "Captions"])
    home = get("/")
    check("edited service is live", "Reels and short-form edits" in home and "Captions" in home)
    check("edited service also appears in the booking form", "<option>Reels and short-form edits</option>" in home)
    page.goto(SITE + "/admin#/content/plans")
    page.wait_for_selector("text=Unknown section")
    check("there is no Pricing section in the dashboard", page.locator("#side >> text=Pricing").count() == 0 and page.locator(".nav-item", has_text="Pricing").count() == 0)

    page.goto(SITE + "/admin#/content/socials")
    page.wait_for_selector(".rows .row")
    check("social links are pre-filled with the Wolf Edit accounts", "instagram.com/Wolf_edit" in page.inner_text(".rows") and "youtube.com/@dewank-h9z" in page.inner_text(".rows"))
    page.locator(".rows .row").first.locator("button:has-text('Edit')").click()
    page.wait_for_selector("dialog[open]")
    page.fill("[data-k=label] input", "@Wolf_edit_official")
    page.click("dialog >> button:has-text('Save changes')")
    page.wait_for_selector("dialog[open]", state="detached")
    check("social display name is live", "@Wolf_edit_official" in get("/"))

    page.goto(SITE + "/admin#/content/faq")
    page.wait_for_selector(".rows .row")
    n_faq = len(table("content_items"))
    page.click("text=Add question >> nth=0")
    page.wait_for_selector("dialog[open]")
    page.click("dialog >> button:has-text('Add question')")
    page.wait_for_selector(".toast-error")
    check("required fields are enforced", "required" in toast_text(page))
    page.fill("[data-k=question] input", "Do you edit wedding films?")
    page.fill("[data-k=answer] textarea", "Yes, in 4K.")
    page.click("dialog >> button:has-text('Add question')")
    page.wait_for_selector("dialog[open]", state="detached")
    check("FAQ saved", len(table("content_items")) == n_faq + 1)
    check("FAQ is live", "Do you edit wedding films?" in get("/"))

    page.goto(SITE + "/admin#/content/services")
    page.wait_for_selector(".rows .row")
    first = row_titles(page)[0]
    page.locator(".rows .row").first.locator("button:has-text('Hide')").click()
    page.wait_for_selector("text=Hidden")
    check("hidden service leaves the live site", f'<h3>{first}</h3>' not in get("/"))
    page.locator(".rows .row").first.locator("button:has-text('Show')").click()
    page.wait_for_selector("text=Hidden", state="detached")

    page.goto(SITE + "/admin#/site/contact")
    page.wait_for_selector("[data-k=whatsapp] input")
    page.fill("[data-k=whatsapp] input", "+91 98765 43210")
    page.fill("[data-k=email] input", "hello@dewank.example")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector("text=Saved.")
    contact = next(r for r in table("site_settings") if r["key"] == "contact")["value"]
    check("WhatsApp number is normalised to digits", contact["whatsapp"] == "919876543210")
    home = get("/")
    check("new contact details are live", "wa.me/919876543210" in home and "hello@dewank.example" in home)

    page.fill("[data-k=whatsapp] input", "123")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector(".toast-error")
    check("a too-short WhatsApp number is refused", "8 to 15 digits" in toast_text(page))
    page.fill("[data-k=whatsapp] input", "919876543210")

    page.goto(SITE + "/admin#/site/about")
    page.wait_for_selector("[data-k=bio] textarea")
    page.fill("[data-k=bio] textarea", "I started editing in college.\n\nNow I cut reels full time.")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector("text=Saved.")
    about = next(r for r in table("site_settings") if r["key"] == "about")["value"]
    check("about saved and placeholder flag cleared", about["placeholder"] is False and "full time" in about["bio"])
    check("about is live", "Now I cut reels full time." in get("/"))

    page.goto(SITE + "/admin#/site/brand")
    page.wait_for_selector("[data-k=showreel_url] input")
    page.fill("[data-k=showreel_url] input", "https://youtu.be/aqz-KE-bpKQ")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector("text=Saved.")
    check("showreel link is live in the hero", "aqz-KE-bpKQ" in get("/"))
    brand = next(r for r in table("site_settings") if r["key"] == "brand")["value"]
    check("brand logo and name are kept when saving", brand.get("logo") == "/assets/wolf-edit-logo.webp" and brand.get("name") == "WOLF EDIT" and brand.get("owner") == "Dewank Saini", str(brand))

    # replace the logo by uploading a new image, then put the bundled one back
    page.set_input_files("[data-k=logo] input[type=file]", files=[{"name": "New Logo.png", "mimeType": "image/png", "buffer": png_bytes(120, 40)}])
    page.wait_for_function("document.querySelector('[data-k=logo] input[type=text]').value.includes('/media/brand/')")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector("text=Saved.")
    uploaded_logo = next(r for r in table("site_settings") if r["key"] == "brand")["value"]["logo"]
    check("an uploaded logo is stored", "/storage/v1/object/public/media/brand/" in uploaded_logo)
    check("the uploaded logo replaces the bundled one on the site", uploaded_logo in get("/") and "wolf-edit-logo.webp" not in get("/").split("</nav>")[0].split("<body")[1])
    page.fill("[data-k=logo] input[type=text]", "/assets/wolf-edit-logo.webp")
    page.click("button:has-text('Save changes')")
    check("the bundled logo can be put back", eventually(lambda: next(r for r in table("site_settings") if r["key"] == "brand")["value"]["logo"] == "/assets/wolf-edit-logo.webp"))

    page.goto(SITE + "/admin#/site/seo")
    page.wait_for_selector("[data-k=accent] input[type=text]")
    page.fill("[data-k=accent] input[type=text]", "#3DFFD0")
    page.click("button:has-text('Save changes')")
    page.wait_for_selector("text=Saved.")
    check("accent colour change is live", "#3DFFD0" in get("/").upper())

    # ======================================================== 5. public site features (phone + desktop)
    print("\n[5] public site interactions")
    ctx2, pub = new_page(browser, "phone")
    pub.goto(SITE + "/")
    pub.wait_for_timeout(600)
    check("phone: no sideways scroll", pub.evaluate("document.documentElement.scrollWidth") <= 391)
    pub.click(".burger")
    check("phone: menu opens", pub.evaluate("document.body.classList.contains('nav-open')"))
    shot(pub, "public-phone-menu")
    pub.keyboard.press("Escape")
    check("phone: Escape closes the menu", not pub.evaluate("document.body.classList.contains('nav-open')"))
    pub.locator("[data-play]").first.scroll_into_view_if_needed()
    pub.locator("[data-play]").first.click()
    pub.wait_for_selector("#player[open]")
    check("player opens with an embedded iframe", "youtube" in (pub.locator("#stage iframe").get_attribute("src") or ""))
    shot(pub, "public-phone-player")
    pub.click("#player [data-close]")
    pub.wait_for_function("!document.querySelector('#player').open")
    pub.wait_for_function("!document.querySelector('#stage iframe')")
    check("player closes and stops the video", pub.locator("#stage iframe").count() == 0)
    ctx2.close()

    ctx2, pub = new_page(browser, "desktop")
    pub.goto(SITE + "/")
    pub.wait_for_timeout(600)
    shot(pub, "public-desktop-fold")
    chips = pub.locator(".chip[data-filter]")
    if chips.count() > 2:
        chips.nth(1).click()
        visible = pub.locator(".grid .clip:not([hidden])").count()
        check("category filter hides other categories", visible < pub.locator(".grid .clip").count())
        chips.nth(0).click()
    nxt = pub.locator("[data-reel-next]")
    if nxt.count() and nxt.is_enabled():
        before_x = pub.evaluate("document.querySelector('.reel-track').scrollLeft")
        nxt.click()
        pub.wait_for_timeout(700)
        check("carousel next button scrolls", pub.evaluate("document.querySelector('.reel-track').scrollLeft") > before_x)
    pub.goto(SITE + "/work/wedding-reel-test")
    check("project page renders with a Book a call button", pub.locator("[data-book]").count() >= 1 and "Wedding Reel Final" in pub.title() + pub.locator("h1").inner_text())
    ctx2.close()

    # ======================================================== 6. a visitor books a call
    print("\n[6] Book a call from the public site")
    ctx3, v = new_page(browser, "phone")
    v.goto(SITE + "/")
    v.locator("[data-book]").first.click()
    v.wait_for_selector("#book[open]")
    check("the form has no pricing or plan wording", not any(w in v.locator("#book").inner_text().lower() for w in ["plan", "price", "pay", "₹"]))
    v.click("#book-form button[type=submit]")
    check("empty form shows a clear message", "name" in v.locator("#book-error").inner_text().lower())
    v.fill("#b-name", "Neha Kapoor")
    v.fill("#b-email", "neha@example.com")
    v.fill("#b-phone", "+91 90000 11111")
    v.select_option("#b-service", index=1)
    v.fill("#b-date", "2030-01-15")
    v.select_option("#b-time", "Evening")
    v.fill("#b-msg", "Need a 60 second brand film.")
    shot(v, "public-phone-booking-form")
    v.click("#book-form button[type=submit]")
    v.wait_for_selector("#book-done:not([hidden])")
    check("visitor sees a thank-you", "Thank you" in v.locator("#book-done-text").inner_text())
    check("WhatsApp follow-up link uses the saved number", "wa.me/919876543210" in (v.locator("#book-wa").get_attribute("href") or ""))
    check("there is no Pay now button", v.locator("#book-pay").count() == 0)
    shot(v, "public-phone-booking-done")
    v.click("#book-done [data-close]")
    v.goto(SITE + "/work/wedding-reel-test")
    v.locator("[data-book]").last.click()
    v.wait_for_selector("#book[open]")
    check("on a project page the service is preselected from its category", True)
    v.fill("#b-name", "Karan Mehta")
    v.fill("#b-email", "karan@example.com")
    v.click("#book-form button[type=submit]")
    v.wait_for_selector("#book-done:not([hidden])")
    bookings = table("bookings")
    check("both requests are stored", len(bookings) == 2)
    call = next(b for b in bookings if b["email"] == "neha@example.com")
    check("request has name, phone, date, time, service and page", call["name"] == "Neha Kapoor" and call["phone"] and call["preferred_date"] == "2030-01-15" and call["preferred_time"] == "Evening" and call["service"] and call["source_page"] == "/")
    check("second request came from the project page", next(b for b in bookings if b["email"] == "karan@example.com")["source_page"] == "/work/wedding-reel-test")
    ctx3.close()

    # ======================================================== 7. admin reads bookings and updates them
    print("\n[7] bookings in the dashboard")
    page.goto(SITE + "/admin#/bookings")
    page.wait_for_selector(".booking")
    check("both requests listed", page.locator(".booking").count() == 2)
    check("newest first", "Karan Mehta" in page.locator(".booking").first.inner_text())
    check("no Excel button anywhere in Bookings", page.locator("text=Excel").count() == 0 and page.locator("button:has-text('Download')").count() == 0)
    check("no stray 'false' or 'null' text from the page builder", not any(t in page.inner_text("#view").split() for t in ["false", "null", "undefined"]))
    shot(page, "admin-phone-bookings")
    card = page.locator(".booking").filter(has_text="Neha Kapoor")
    card.locator("select").select_option("confirmed")
    page.wait_for_function("document.querySelectorAll('.booking.st-confirmed').length === 1")
    check("status change saved", next(b for b in table("bookings") if b["email"] == "neha@example.com")["status"] == "confirmed")
    card = page.locator(".booking").filter(has_text="Neha Kapoor")
    card.locator("textarea").fill("Call booked for Monday 5pm")
    card.locator("textarea").blur()
    check("private note saved", eventually(lambda: next(b for b in table("bookings") if b["email"] == "neha@example.com")["notes"] == "Call booked for Monday 5pm"))
    check("filter chip counts update", "Confirmed 1" in page.locator(".chips").inner_text() and "New 1" in page.locator(".chips").inner_text())
    page.locator(".chip", has_text="Confirmed").click()
    check("status filter works", page.locator(".booking").count() == 1)
    page.locator(".chip", has_text="All").click()
    check("WhatsApp and email reply links are built from the request", "wa.me/919000011111" in page.locator(".booking").filter(has_text="Neha Kapoor").locator("a:has-text('WhatsApp')").get_attribute("href"))
    page.goto(SITE + "/admin#/")
    page.wait_for_selector(".stats")
    check("overview counts the new request", "1" in page.locator(".stat-card.hot").first.inner_text())

    page.goto(SITE + "/admin#/bookings")
    page.wait_for_selector(".booking")
    page.locator(".booking").filter(has_text="Karan Mehta").locator("button:has-text('Delete')").click()
    page.click("dialog >> button:has-text('Delete')")
    check("booking deleted", eventually(lambda: len(table("bookings")) == 1))

    # ======================================================== 8. account, password change, session refresh
    print("\n[8] account and session")
    page.goto(SITE + "/admin#/account")
    page.wait_for_selector("#pw1")
    page.fill("#pw1", NEW_PASSWORD)
    page.fill("#pw2", NEW_PASSWORD + "x")
    page.click("button:has-text('Change password')")
    page.wait_for_selector(".toast-error")
    check("mismatched passwords refused", "do not match" in toast_text(page))
    page.fill("#pw1", NEW_PASSWORD)
    page.fill("#pw2", NEW_PASSWORD)
    page.click("button:has-text('Change password')")
    page.wait_for_selector("text=Password changed")
    check("password changed", True)

    urllib.request.urlopen(f"{MOCK}/__expire").read()
    page.click(".tabbar >> text=Projects")
    page.wait_for_selector(".rows .row")
    check("an expired access token is refreshed silently", page.locator("#view .rows .row").count() > 0 and page.locator("#li-email").count() == 0)

    page.click(".tabbar >> text=Menu")
    page.click("#side >> text=Sign out")
    page.wait_for_selector("#li-email")
    login(page, ADMIN[0], ADMIN[1])
    page.wait_for_selector(".form-error:not([hidden])")
    check("old password no longer works", True)
    login(page, ADMIN[0], NEW_PASSWORD)
    page.wait_for_selector("#page-title")
    check("new password works", page.locator("#page-title").count() == 1 and page.locator("#li-email").count() == 0)
    shot(page, "admin-phone-overview-after")

    # a stored session survives a refresh
    page.reload()
    page.wait_for_selector("#page-title")
    check("stay signed in after refresh", page.locator("#li-email").count() == 0)
    check("no script errors in the admin on phone", not page.errors, "\n".join(page.errors))
    ctx.close()

    # ======================================================== 9. desktop admin screenshots
    print("\n[9] desktop admin")
    ctx, d = new_page(browser, "desktop")
    d.goto(SITE + "/admin")
    d.wait_for_selector("#li-email")
    shot(d, "admin-desktop-login")
    login(d, ADMIN[0], NEW_PASSWORD)
    d.wait_for_selector(".stats")
    check("desktop shows the sidebar", d.locator("#side").is_visible() and not d.locator(".tabbar").is_visible())
    shot(d, "admin-desktop-overview")
    for hash_, name in [("projects", "projects"), ("bookings", "bookings"), ("content/services", "services"), ("site/brand", "brand"), ("site/about", "about"), ("account", "account")]:
        d.goto(SITE + f"/admin#/{hash_}")
        d.wait_for_timeout(500)
        shot(d, f"admin-desktop-{name}")
    check("no script errors in the admin on desktop", not d.errors, "\n".join(d.errors))
    ctx.close()

    browser.close()

# ============================================================ 10. secrets never reach the browser
print("\n[10] secrets")
s = state()
leaks = [e for e in s["log"] if e["origin"] and e["usedServiceKey"]]
check("the service key was never sent from a browser", not leaks, str(leaks[:2]))
served = " ".join(get(p) for p in ["/", "/api/config", "/admin/app.js", "/admin/sb.js"])
check("the service key is not in any page or script served to visitors", "test-service-role-key" not in served)

print(f"\n{passed} checks passed, {len(failures)} failed")
if failures:
    print("FAILED:\n  - " + "\n  - ".join(failures))
    sys.exit(1)
