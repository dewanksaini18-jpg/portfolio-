# WOLF EDIT: portfolio website with a built-in dashboard

A fast, dark, cinematic portfolio for **Wolf Edit** (video editor and motion designer), plus a private dashboard where you manage everything from your phone or computer. No code editing needed.

**Public site:** hero with logo and showreel, video carousel and project cards with a player, services, about, process, tools, testimonials and client logos (placeholders until you add real ones), FAQ, and a contact section with WhatsApp, email and social links. A **Book a call** button is always one tap away. There is no pricing on the site.

**Dashboard (`/admin`):** secure sign-in, then:

- add, edit, delete, hide and reorder projects; pick which ones are featured first
- paste YouTube, Instagram or Google Drive links, or upload a video or thumbnail
- edit services, about, contact details, social links, logo, colours and search/share text
- read **Book a call** requests, set their status, add notes, reply on WhatsApp or email

Everything is saved in Supabase, so it survives refreshes and shows up on the live site within about 30 seconds.

## Start here

Follow **[docs/DEPLOY.md](docs/DEPLOY.md)**. It takes about 30 minutes: create a free Supabase project, run one SQL file, create your login, and deploy to Vercel. Your dashboard is at `/admin` on your site (for example `https://wolfedit.com/admin`). The hosting is free; the domain name wolfedit.com is a yearly fee. The guide explains the limits of the free plans.

## What is inside

```
public/            the website's files (styles, scripts, logo, the dashboard in public/admin)
api/               small server functions: pages, "Book a call", settings
lib/               shared server code (page builder, Supabase helper)
supabase/schema.sql   the database, security rules and file storage (run once)
server.js          run the same site on any computer or Node host
test/              automated tests
docs/DEPLOY.md     step-by-step setup
```

There are **no dependencies** to install. It needs Node 18 or newer only if you want to run it on your own computer (`npm start`).

## What is filled in, and what is a placeholder

Filled in from what you told me: brand name **WOLF EDIT**, your logo, tagline *"Your vision. My edit. One powerful story."*, email `dewanksaini18@gmail.com`, Instagram `@Wolf_edit`, YouTube *Wolf Edit* (`youtube.com/@dewank-h9z`).

Starter text you should check: the WhatsApp number (`918053352071`, carried over from your earlier brand), your name "Dewank Saini" in About, the services and process wording, and the tool list.

Dashed **placeholders** (nothing was invented): videos, testimonials, client logos, the numbers, your bio and the FAQ answers. The dashboard's **Overview** lists what is left to replace.

## Changing things

Everything on the site is edited in the dashboard. To change what a form field looks like or add a new field, edit `public/admin/schema.js` (what the dashboard asks for) and `lib/render.js` (how the site shows it).
