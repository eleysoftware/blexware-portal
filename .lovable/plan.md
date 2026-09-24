# Visible client sign-in + a tidier team portal

## 1. Make "Sign in" easy to find on blexware.com

Right now the site header only shows the menu and "Get a Free Quote", so a client has no way to find the portal.

- **Header (desktop):** add a **Client login** button next to "Get a Free Quote". When already signed in, it reads **My portal** and goes straight to the portal (or the team portal for staff).
- **Header (mobile menu):** same link at the bottom of the menu, above "Get a Free Quote".
- **Footer:** add a "Client portal" link under the company links.

## 2. Reorganize the team portal home

Today the top of the page is one long row of 9 mixed buttons (sign out, import, new invoice, archived, test data, cleanup, convert proposals) plus a mail-status sentence, then a row of ~15 status pills. It reads as clutter.

New layout, top to bottom:

```text
Team portal                                  [Import project] [+ New invoice]
Signed in as kamal@...   ·   Invoice mail: last ran Sep 24, 3 sent   [More v]
-------------------------------------------------------------------------------
[ Active clients 12 ] [ Awaiting you 3 ] [ Outstanding $4,200 ] [ Scheduled 2 ]
-------------------------------------------------------------------------------
Search [______________]   Status [All v]   View: (Active) (Archived)
-------------------------------------------------------------------------------
Client cards (unchanged content, cleaner header: name, email, projects,
outstanding, last activity, Edit client in the same row)
```

- **Primary actions only in the header:** Import existing project, New invoice.
- **"More" menu** (dropdown) holds the rarely used tools: Show/Hide test data, Clean up test clients, Convert existing proposals, Sign out.
- **Summary tiles** give a one-glance overview (counts from data already loaded — no new data).
- **Status pills become a single "Status" dropdown** with counts; Active/Archived becomes a two-option toggle next to it.
- **Client card header:** "Edit client" moves into the header row instead of its own line underneath.
- The out-of-credits warning stays, just placed above the tiles.

Nothing about what each project row shows or does changes.

## Technical notes

- `src/components/Header.tsx`: session check client-side via `supabase.auth.getSession()` + `onAuthStateChange` in an effect (SSR renders "Client login" by default); links to `/auth` or `/portal`.
- `src/components/Footer.tsx`: add `/auth` link.
- `src/routes/_authenticated/admin/index.tsx`: restructure the PageHero children and filter bar; use existing `ui/dropdown-menu` and `ui/select`; tiles computed from `clients`, `billing`, `invoicesByQuote`. No server or schema change.
