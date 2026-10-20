# Set up and go live (about 30 minutes, all free tiers)

You need three free accounts: **Supabase** (database, logins, file storage), **GitHub** (to hold the code) and **Vercel** (to host the site). Nothing here needs coding.

What you get at the end:

- your public site at `https://your-project.vercel.app` (and at **wolfedit.com** once you own that domain, see "Your own domain" below)
- your private dashboard at the same address plus `/admin`: `https://your-project.vercel.app/admin` now, `https://wolfedit.com/admin` later. It works on phone and computer. Bookmark it.
- every "Book a call" request saved in the dashboard under **Bookings**

## What is free and what is not

| Part | Cost |
|---|---|
| Website, dashboard, database, logins, file storage (Vercel + Supabase free plans) | free |
| The address `your-project.vercel.app` | free |
| **wolfedit.com** | **not free.** A domain is a yearly fee paid to a domain seller (for example Namecheap, GoDaddy, Hostinger or Cloudflare). I cannot buy it for you, and I could not check whether it is still available. Search it at a seller; if it is taken, try `wolfedit.in`, `wolf-edit.com` or `wolfedit.studio`. |

Two limits of the free plans to know about:

- **Supabase pauses a free project after 1 week without activity.** When that happens the live site would show the grey starter placeholders until you press *Restore* in Supabase. Prevent it with any free uptime-monitor service (for example **cron-job.org** or UptimeRobot; check its terms): add an *HTTP(s)* check on your homepage every 5 minutes. Each visit loads your content from the database, so the database never sleeps. Also, simply opening your site or dashboard at least once a week does the same. (Supabase free plan: 500 MB database, 1 GB file storage, 50 MB per uploaded file. Source: supabase.com/pricing.)
- **Vercel's free "Hobby" plan is, in Vercel's own words, for "non-commercial, personal use only"** (vercel.com/docs/plans/hobby). A freelance portfolio that gets you clients can be read as commercial use. Many people run on Hobby anyway, but Vercel can ask you to upgrade (Pro is a paid plan). If you want to stay clearly inside the free terms, tell me and I will adapt this project for a free host that allows business sites.

---

## 1. Create the database (Supabase)

1. Go to **supabase.com**, sign in and press **New project**. Pick a name, set a database password (save it somewhere) and choose the region closest to your visitors (for India: *Mumbai*).
2. When the project is ready, open **SQL Editor** > **New query**.
3. Open the file `supabase/schema.sql` from this project, copy everything, paste it into the editor and press **Run**. You should see "Success". It is safe to run again.
   This creates the tables, the security rules and the `media` storage bucket for uploads.

## 2. Create your login and make yourself the admin

1. In Supabase open **Authentication** > **Users** > **Add user** > **Create new user**.
   Enter your email (`dewanksaini18@gmail.com`) and a strong password, and tick **Auto Confirm User**.
2. Open **SQL Editor** > **New query**, paste this and press **Run**:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'dewanksaini18@gmail.com'
   on conflict do nothing;
   ```

   Only accounts in this list can change anything. Everyone else can only read what is published.
3. Switch off public sign-ups so nobody else can create accounts: **Authentication** > **Sign In / Providers** (on some versions: **Settings**) > turn **off** "Allow new users to sign up".

## 3. Copy your three Supabase values

Open **Project Settings** > **API** (or **API Keys**) and copy:

| Name for Vercel | Where to find it | Secret? |
|---|---|---|
| `SUPABASE_URL` | Project URL, like `https://abcd1234.supabase.co` | no |
| `SUPABASE_ANON_KEY` | the `anon` / **publishable** key | no, safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` / **secret** key | **yes. Never share it or put it in the browser** |

The service key is used only on the server, so the website can save a "Book a call" request without letting visitors read or change anything. If you skip it, the website works but booking requests cannot be saved.

## 4. Put the code on GitHub

1. Create a free account at **github.com**, then **New repository** (private is fine).
2. Upload this project's files to it (**Add file** > **Upload files**, drag the whole folder's contents in). Do not upload a `.env` file.

## 5. Publish on Vercel

1. Go to **vercel.com**, sign in with GitHub and press **Add New** > **Project**. Choose your repository.
2. Framework preset: **Other**. Leave the build and output settings empty. (There is no build step.)
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | from step 3 |
   | `SUPABASE_ANON_KEY` | from step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 3 |
   | `SITE_URL` | *optional on the first deploy.* Your final address, no trailing slash, for example `https://wolfedit.com`. Add it once you know your address, then redeploy. |

4. Press **Deploy**. When it finishes, open your site. It already shows Wolf Edit with clearly marked placeholders.
   *Optional, for speed in India:* **Settings** > **Functions** > **Function Region** > Mumbai (`bom1`), then redeploy.

## 6. First sign-in

1. Open `https://your-site/admin` and sign in with the email and password from step 2.
2. The first time, the dashboard fills your database with the starter content so every section is ready to edit.
3. Work through **Overview > Do this next**:
   - **Projects**: add your videos (see below).
   - **Brand and hero**: paste your showreel link. Your logo is already set; you can swap it here.
   - **About**: write your story and add a photo.
   - **Contact and booking**: check your email and WhatsApp number.
   - **Social links**: Instagram `Wolf_edit` and YouTube `Wolf Edit` are already filled in.
   - **Testimonials, Client logos, Numbers**: these are dashed placeholders. Replace them with real ones or press **Hide**. Nothing is invented for you.
4. Open the website. Changes appear within about 30 seconds.

### Adding a project

**Projects > Add project**, then either:

- paste a **YouTube** link (a Short is detected and set to portrait; the thumbnail is automatic), or
- paste an **Instagram** reel/post link or a **Google Drive** link, or
- press **Upload a video file** (up to 50 MB on Supabase's free plan, MP4/MOV/WebM).

Instagram and Vimeo links need a thumbnail: upload one under **Thumbnail**. Google Drive videos must be shared as *Anyone with the link*.

Use **Feature** to put a project in the homepage carousel. Use the arrows or **To top** to reorder. **Hide** keeps a project but takes it off the site.

### Book a call requests

Visitors press **Book a call**, fill in name, email, optional phone, what they need, a preferred date and time, and a message. The request is saved under **Bookings**. There you can change the status (new, contacted, confirmed, completed, cancelled), add private notes, and reply on WhatsApp or by email in one tap. After sending, the visitor also gets a **Continue on WhatsApp** button.

---

## Your own domain: wolfedit.com (optional, paid yearly)

1. Buy `wolfedit.com` from a domain seller (not free; see the table at the top).
2. Vercel > your project > **Settings** > **Domains** > add `wolfedit.com` and `www.wolfedit.com`. Vercel shows the exact DNS records to enter at your domain seller (usually an `A` record for `wolfedit.com` and a `CNAME` for `www`). It can take from a few minutes to a few hours to go live.
3. Set `SITE_URL` to `https://wolfedit.com` and redeploy (**Deployments** > the latest one > **Redeploy**).
4. Your dashboard is now `https://wolfedit.com/admin`.
5. Submit `https://wolfedit.com/sitemap.xml` in Google Search Console.

## Run it on your own computer (optional)

```bash
cp .env.example .env     # then fill in the three Supabase values
npm start                # http://localhost:3000   (dashboard: /admin)
```

Needs Node 18 or newer. There is nothing to install: the project has no dependencies.

## Run the tests (optional)

```bash
npm test                       # server checks, no setup needed
bash test/run-schema-test.sh   # database security rules, needs a local PostgreSQL
bash test/run-e2e.sh           # browser test of the dashboard, needs Python + Playwright
```

---

## Troubleshooting

| You see | Do this |
|---|---|
| "Connect Supabase first" on `/admin` | The two Supabase variables are missing in Vercel. Add them and redeploy. |
| "Run the database setup" | Run `supabase/schema.sql` (step 1), then reload. |
| "This account is not an admin yet" | Run the `insert into public.admins` SQL from step 2 with the email you signed in with. |
| "Booking saves are not switched on yet" | Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy. |
| Website still shows the old thing | Pages are cached for up to 30 seconds. Wait a moment and refresh. |
| The website says "noindex" in the page source | That is deliberate until you add real content, so Google does not list placeholders. It switches itself off once the dashboard has content. |
| Upload says the file is too large | The free plan allows 50 MB per file. Upload to YouTube or Google Drive and paste the link. |
| Fonts look different | The site loads *Bricolage Grotesque* and *Manrope* from Google Fonts. If a visitor blocks Google Fonts, a clean system font is used instead. |

## How the security works

- Visitors can only **read published** content. Drafts and bookings are invisible to them.
- Only accounts listed in the `admins` table can change content, upload files or read bookings. This is enforced by the database itself (row level security), not by the dashboard page.
- The browser only ever gets the public (anon) key. The service key stays on the server.
- Booking forms have a hidden spam trap, input checks and a best-effort limit of 6 requests per 10 minutes per visitor.
- Content is escaped before it is shown, so pasted text cannot run scripts.
