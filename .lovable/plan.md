
# BLEXware.com — Phase 1 (Frontend)

## Important constraint
Lovable Cloud is disabled, so the backend halves of the spec cannot be built yet: quote persistence, PDF upload + virus scan, admin portal with auth/MFA/RBAC, CMS storage, AI proposal/contract/invoice generation, email/SMS notifications, audit logs, data retention/export tooling.

This plan delivers the full public marketing site and the complete Free Quote form UI (validated, multi-step) with submission wired to a clearly-marked placeholder that swaps to a real backend call the moment Cloud is enabled. No localStorage-as-database workarounds.

## 1. Brand assets
Use the uploaded BLEXware wordmark (mint "BLEX" + charcoal "ware") as the real site logo — CDN asset pointer, rendered in header and footer with proper alt text. A square version becomes the favicon in `public/`, replacing the default Lovable icon.

## 2. Project knowledge
Store all three documents as durable project memory:
- `mem://specs/functional` — sitemap, page content, quote workflow, admin scope, data model, roadmap.
- `mem://specs/security-compliance` — auth/RBAC, encryption, upload security, rate limiting, audit logs, privacy/cookies/retention, AI governance, WCAG 2.2 AA, SEO, performance, monitoring, DR.
- `mem://design/brand-palette` — the full Brand Palette v1.0: color table, typography, component treatments (buttons, cards, nav, tabs, icons, footer, CTA), background alternation, status colors, future dark mode.
- `mem://index.md` — Core rules: mint/charcoal brand, premium modern-SaaS enterprise feel (Linear/Vercel/Stripe polish, never bright-blue-tech), mint as accent only, WCAG 2.2 AA, SEO/schema every page, AI output always human-reviewed.

## 3. Design system (from Brand Palette v1.0)
All values become oklch semantic tokens in `src/styles.css` — no hardcoded color utilities anywhere.

| Token | Hex |
|---|---|
| Primary Mint | #A8D8C2 |
| Primary Emerald (CTA) | #3A8F73 |
| Hover Emerald | #2E715C |
| Charcoal | #3F3F46 |
| Slate (body text) | #5E6470 |
| Headline | #23272F |
| Background | #F8FAFC |
| Surface | #FFFFFF |
| Soft Mint | #F5FBF8 |
| Highlight | #EAF7F2 |
| Border | #E5E7EB |
| Success / Warning / Error / Info | #16A34A / #F59E0B / #DC4C64 / #2563EB |

Typography: Plus Jakarta Sans headlines, matching body face, loaded via `<link>` in `__root.tsx`. Section titles use mint only for the emphasized word. 12px CTA radius, 12–16px cards with 1px border, light shadow, hover lift 6px + mint top border. Sticky white nav with subtle bottom border, logo left, menu centered, emerald Free Quote button right. Outline icons in slate, mint on hover. Charcoal (#23272F) footer with mint link hover. Deep-emerald CTA band. Sections alternate white / off-white / very light mint. Dark-mode token set stubbed (#111827 / #1F2937 / #F9FAFB, mint unchanged) but not shipped as a toggle. Motion restrained, `prefers-reduced-motion` respected.

## 4. Routes
```text
/                 Home
/industries       Tabbed: Business, Real Estate, Sports, Entertainment,
                  Healthcare, Education, Nonprofit, Technology
/services         9 service cards
/portfolio        Grid
/portfolio/$slug  Case study detail
/resources        Article cards (static content for now)
/resources/$slug  Article page
/free-quote       8-step quote form
/contact          Contact form
/about            Company / vision
/privacy /terms /cookies /accessibility /ai-use   Legal pages
```
Shared header + footer (logo, nav, services, industries, portfolio, resources, social, contact, copyright, privacy, terms, newsletter signup UI).

## 5. Home page
Hero ("AI-Powered Software Built To Grow Your Business", white with subtle gradient) + Free Quote and View Portfolio CTAs and a generated collage image; Why BLEXware (3 columns); Featured Services (8 cards); Portfolio Spotlight (Build Financial Wellness, KYC Investments, SportE Golf); 7-step process timeline; testimonial carousel; emerald closing CTA band.

## 6. Industries
All 25 industries under 8 tabs (inactive white, hover light mint, active deep emerald). Each: hero image, sales copy, benefits, portfolio tie-in, and a Free Quote button deep-linking to `/free-quote?industry=real-estate` so the dropdown arrives pre-selected.

## 7. Free Quote form
Multi-step with progress indicator and Zod validation: Industry (prefilled from query param) → Project Type → Project Name → Description → Budget (optional) → Launch Date → PDF upload (client-side PDF-only + 20 MB cap, with clear notice that server-side scanning runs on submit) → Contact block (email required; company/contact/phone optional). Consent checkbox and AI-disclosure notice. Submit shows a "backend not yet connected" state.

## 8. Compliance & quality
Cookie consent banner (Accept / Reject / Customize). Legal pages as app-owned editable content with no unverified certification claims — I'll ask you for organization-specific facts (retention periods, subprocessors, contact addresses) before writing them; placeholders are flagged, not invented. Accessibility: keyboard nav, visible focus rings, alt text, ARIA, contrast checked against the palette, reduced motion. SEO: per-route `head()` with unique title/description/OG/Twitter, Organization + Article JSON-LD, canonicals, `robots.txt`, sitemap. Performance: lazy loading, optimized imagery.

## 9. Technical notes
TanStack Start + React 19 + TypeScript + Tailwind v4, file routes under `src/routes/`. Content (industries, services, portfolio, testimonials, articles) lives in typed modules under `src/content/` shaped to the spec's database tables, so migration to real tables is a data-source swap, not a rewrite. Hero and industry imagery generated as assets.

## What comes after you enable Cloud
Supabase tables (Quote, Article, Portfolio, Testimonial, Administrator, audit log) with RLS and grants, PDF storage with signed URLs and server-side validation, admin portal with MFA and a role table, AI proposal → contract → invoice workflow with stored prompts and manual generate buttons, Resend/Twilio notifications.
