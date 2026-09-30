# AKI HACKS 2026

Next.js site for akihacks.xyz with a Supabase-backed admin at `/admin`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in.
3. Run `supabase/schema.sql` in the Supabase SQL editor (safe to re-run; run it again after pulling updates).
4. `npm run dev`, then open `/admin`.

## Admin

- Sign in with an email in `ADMIN_EMAILS` plus `ADMIN_PASSWORD` (owner). Owners add more admins under **Admins & account**; those sign in with their own email and password (scrypt-hashed in `admin_users`).
- Five wrong passwords lock an email+IP for 15 minutes.
- Every save is kept in `site_content_history` (last 50 per section) and can be loaded back from **History**. Two people editing the same section get a conflict warning instead of overwriting each other.
- Links and emails are validated; photos must be uploaded (PNG/JPEG/WebP/GIF, 5 MB) so `next/image` never meets an unknown host. A photo that is on the site can't be deleted.
- The browser never talks to Supabase: everything goes through server actions using `SUPABASE_SERVICE_ROLE_KEY`.

## How content works

- Launch copy lives in `lib/content.ts` (`defaults`). Rows in `site_content` override it per section.
- The admin forms are generated from `lib/schema.ts`. Adding an editable field = add it to `defaults` and `lib/schema.ts`, then use it in the page.
- Phones and reduced-motion users get the image hero and plain sections; desktops get the 3D boat journey.
