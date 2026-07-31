## Goal

Make the meaning behind the name explicit — **BLEX = Black Excellence** — and shift the site from pure product screenshots toward people: African American engineers, consultants, and teams delivering technical services.

## Content changes

**About page (`src/routes/about.tsx`)**
- New section directly under the hero: "The name" — BLEX stands for Black Excellence, ware for the software we build. Short paragraph on excellence as a standard of craft, and on building relationships, not just deliverables.
- Add a fifth value card: "Relationships outlast releases" — the work is a partnership, not a ticket queue.
- Add a photo band of the team at work.

**Homepage (`src/routes/index.tsx`)**
- Add a "people" section between Process and Testimonials: image + short copy on partnership and the Black Excellence standard, linking to About.
- Keep the existing hero collage (product-focused) but pair the new section image with real faces so the page isn't all abstract UI.

**Footer (`src/components/Footer.tsx`)**
- One-line tagline under the logo blurb: "BLEX — Black Excellence. Software built by people who stay."

**Contact page**
- Swap the page into a two-column layout with a warm photo of a consultant on a call beside the form (form logic untouched).

## Imagery

Generate 4 new photographic assets (`src/assets/`), all in the existing palette (mint/emerald accents, charcoal, soft neutral light — editorial, not stock-cheesy):
1. `team-collab.jpg` — two Black software engineers at a monitor reviewing code in a bright modern studio.
2. `consultation.jpg` — a Black consultant in conversation with a client across a table, laptop open, warm natural light.
3. `engineer-portrait.jpg` — a Black developer at a standing desk, focused, dual monitors with abstract dashboards.
4. `workshop.jpg` — a small diverse team led by a Black tech lead at a whiteboard during a discovery session.

All images get descriptive alt text, `loading="lazy"` below the fold, explicit width/height, and rounded-2xl treatment consistent with existing cards.

## Technical notes

- Text-free image prompts (no fake logos/UI copy), matching the approach used for the existing assets.
- No new components required beyond reusing `Section` / `SectionHeading`; About and Contact get local layout markup.
- Update the About route's meta description to mention Black Excellence for SEO.
- Presentation-layer only — no changes to forms, validation, or content-model types beyond adding one value entry.

I'll also quietly fix the SSR hydration warning currently showing on the root layout while I'm in these files.
