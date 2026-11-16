# IceBooks Pro: sellable plan

**This repository is the single-coach build.** One Supabase project, one coach (the first account to sign up),
clients linked to that coach. It is not multi-tenant hosting for many unrelated coaches.

## Preserved legacy version

The last pre-rebuild IceBooks (minified bundle, self-hosted, single coach) is preserved, untouched, at:

- Git tag `legacy-v4-selfhosted` (commit `53b89d6`)
- GitHub release `legacy-v4-selfhosted`, with the older bundles attached: `icebooks-v4.5.0-DEPLOY.zip` and
  `IceBooks-Pro-v2.0-Distribution.zip`

History on `main` is never rewritten or deleted.

## Path 1: ship this repo as the self-hosted product

What a buyer receives:

1. **Blank config:** `public/config.js` with empty `SUPABASE_URL` / `SUPABASE_ANON_KEY` placeholders (no keys from this project).
2. **Migrations:** `supabase/migrations/0001` to `0004` (tables, triggers, RLS, keep-alive probe), plus the two edge functions
   (`send-invoice`, `calendar-feed`).
3. **Setup guide:** create a Supabase project, apply the migrations, set the function secrets (`RESEND_API_KEY`,
   `RESEND_FROM_ADDRESS`), configure auth (Site URL, redirect URLs, SMTP), build with `npm run build`, host the `dist/` folder.
   The first signup becomes the coach. `scripts/rls-audit.mjs` verifies the buyer's own project.

To do before selling: write the setup guide, produce the blank-config zip, and add the license/activation approach used by the
other products.

## Path 2: multi-coach hosted version (later)

If a hosted product for many coaches is wanted, it is built **later in a new repository copied from `main`**, not by retrofitting
this one. This repo stays the single-coach reference build.
