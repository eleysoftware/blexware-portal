## Goal

Restructure the About page so the "Our mission" content replaces the current "The name" section, with its text and image split into two columns. The "How engagements run" process list then becomes a full-width section of its own.

## Current state (verified)

`src/routes/about.tsx` currently has:
1. `PageHero`
2. "The name" section — two-column text + `engineerPortrait` image (just added)
3. Combined section — left column is "Our mission" text + `teamCollab` image stacked; right column is "How engagements run" process list
4. Values section
5. "The people" section
6. `CtaBand`

## Changes

### `src/routes/about.tsx`

1. **Remove the entire "The name" section** (lines 66–96).
   - The Black Excellence name-story copy and the `engineerPortrait` image in that section are removed.
   - `engineerPortrait` remains imported because it is still used in the "The people" section below.

2. **Convert "Our mission" into its own two-column Section.**
   - Use the existing `Section` wrapper.
   - Left column: "Our mission" heading and both paragraphs.
   - Right column: `teamCollab` image, with `rounded-2xl`, `object-cover`, `shadow-card`, and descriptive alt text preserved.
   - Apply `grid items-center gap-10 lg:grid-cols-2 lg:gap-14` for alignment and spacing consistent with the previous two-column treatment.

3. **Move "How engagements run" into a separate full-width Section below.**
   - Remove it from the shared two-column grid with "Our mission".
   - Use `SectionHeading` with eyebrow "Process" and title "How engagements run" for consistency with other pages.
   - Render the `processSteps` list across the full container width (single column, same step styling).

## Resulting page order

- PageHero
- Our mission (two-column: text + image)
- How engagements run (full-width process list)
- Values
- The people
- CtaBand

## Scope

Presentation-layer only. No changes to content-model types, forms, validation, or site metadata. SEO description already references Black Excellence and remains unchanged.