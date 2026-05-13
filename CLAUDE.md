# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server at `localhost:4321`
- `npm run build` — static build to `./dist/`
- `npm run preview` — serve the built site locally
- `npm run astro check` — type-check `.astro` files (also runs Astro's content schema validation)
- `npm run astro -- --help` — Astro CLI help

Node `>=22.12.0` is required (see `package.json` engines).

## Architecture

This is an Astro 6 static blog generated from the official `blog` starter. Output is fully static; there is no server runtime.

**Content collection (`src/content.config.ts`)** — the single `blog` collection is loaded via `glob` from `src/content/blog/**/*.{md,mdx}`. Frontmatter is validated by a Zod schema requiring `title`, `description`, `pubDate` (coerced to Date), and optionally `updatedDate` and `heroImage` (typed as an Astro `image()` so it benefits from the asset pipeline). New post fields must be added here or the build will fail type-checking.

**Routing**
- `src/pages/index.astro` — home
- `src/pages/about.astro` — about page
- `src/pages/blog/index.astro` — post index, sorted by `pubDate` descending
- `src/pages/blog/[...slug].astro` — dynamic post route. Uses `getStaticPaths` over the `blog` collection; `params.slug` is `post.id` (the file path relative to the collection base, sans extension). All posts are pre-rendered at build time.
- `src/pages/rss.xml.js` — RSS feed built from the same collection

**Layouts and components** — `src/layouts/BlogPost.astro` is the shared shell for individual posts (hero image, title, date, prose slot). Reusable bits live in `src/components/` (`BaseHead`, `Header`, `Footer`, `FormattedDate`, `HeaderLink`).

**Assets and fonts** — images imported from `src/assets/` go through Astro's image pipeline (optimization, responsive sizing via `<Image>`). Files in `public/` are served as-is. The Atkinson font is loaded as a local font provider in `astro.config.mjs` and exposed via the `--font-atkinson` CSS variable; `BaseHead.astro` calls `<Font cssVariable="--font-atkinson" preload />` to inject the `@font-face` and preload links.

**Site-wide constants** — `src/consts.ts` holds `SITE_TITLE` and `SITE_DESCRIPTION`. `astro.config.mjs` `site` is currently `https://example.com` and should be updated before deploy (canonical URLs, sitemap, RSS, and Open Graph all derive from it). Integrations enabled: `@astrojs/mdx`, `@astrojs/sitemap`.

**Styling** — global styles in `src/styles/global.css` (imported once via `BaseHead.astro`). Per-page styles use Astro's scoped `<style>` blocks.

## Adding a blog post

Create `src/content/blog/<slug>.md` (or `.mdx`) with frontmatter matching the schema in `src/content.config.ts`. The file's path becomes the URL slug; no other registration is needed.

## Writing style for blog posts

These rules are derived from repeated editing on the camwatch series. Apply them when drafting a new post or proposing edits to an existing one. They are guidelines, not laws. Bend them when a specific post needs it, but bend deliberately.

### A post is a story, not a feature dump

The default arc is **Motivation → Design → Implementation → Verification → Lessons → Conclusion**, adjusted per project. Each section should answer the next obvious question the reader has after the previous one:

- **Motivation**: why this problem matters and why now. What was wrong, what was missing, what the constraint was.
- **Design**: the chosen approach at a high level, and (briefly) what was rejected and why. Frame this as a decision, not as documentation.
- **Implementation**: only the parts that surprised you, that a reader will learn from, or that motivate later sections. Skip the file-list dump.
- **Verification**: numbers, side-by-side comparisons, ground-truth tables. This is where the post earns trust.
- **Lessons**: the part the reader carries away after closing the tab.
- **Conclusion**: a short, clean exit. Link the repo or follow-up here.

Order sections by reader logic, not by the order things happened. "What got simpler" should come before "Production numbers"; explain the change before showing its impact.

### TL;DR

Three-beat shape: **why → brief how → what the reader / user gets**. Lead with the bottleneck or motivation, mention the architectural move in one phrase, end with the visible payoff. Cut implementation details that don't help the reader decide whether to keep reading.

The TL;DR is not a place to enumerate every subsystem you killed or every flag you flipped. If a phrase like "10× the input pixels" or "retires the cross-stream sync layer" is in the TL;DR, ask: does the average reader care, or does this serve the author? When in doubt, cut.

### Section-level discipline: only the necessary detail

The job of a section is to explain clearly. Necessary detail belongs; trivia does not. Concrete heuristics:

- If a distinction doesn't change the reader's understanding, drop it. "3060 Ti vs 3060" is noise to a reader who didn't know the Ti variant existed; "3060" carries the same meaning with less friction.
- Prefer one tight sentence over a paragraph that elaborates the obvious.
- Don't list files changed in a code-change section unless the file list itself is the point. Describe the change at the abstraction level the reader needs.
- "Python-only" or "this works because we use uv" type details, if not load-bearing, should be cut.

### Takeaways

Focus on the **biggest** lessons. There can be more than one (camwatch-1 has three), but each should be a load-bearing insight, not a small tactical note. Drop the smaller ones; they dilute the ones that matter.

A good takeaway generalizes beyond this specific project. "Picking the right abstraction is upstream of everything" travels; "We dropped the dual-stream code" does not.

### Wording and terminology

- **Prose-friendly identifiers**: `yolo11l` → `yolo11(large)`, `yolo11n` → `yolo11(nano)`. Engineering shorthand is for code; the blog reads aloud.
- **Don't put backticks on class names or general identifiers in prose** (e.g., write TimestampedFrameBuffer, not the backtick form). Backticks are reserved for: file paths, shell commands, config keys, package names, code-like literals the reader would copy.
- **Attribute precisely**. "The CPU couldn't handle the main stream" is wrong if the bottleneck is the whole laptop (decode, memory bandwidth, single-threading); write "the MacBook Air couldn't handle …". Pick the right noun for the failure mode.
- **No em dashes or en dashes in prose** (already global). Hyphens between numbers for ranges (`30-40 mph`, `8-day retention`) are fine.

### Verify numbers from source

Never assume a metric. If a claim is "about 70% success", query the DB; if it turns out to be 60%, use 60%. Don't invent supporting numbers to make a sentence read better. The reader will trust the post in proportion to how often its specific numbers turn out to be checkable.

This also covers honest framing of claims: if you write "each thumbnail is license-plate-readable", verify that the enrichment pipeline actually uses plates. If it doesn't, the claim is decorative and should be cut or reworded to what the system actually does.

### Visual assets

- **Charts** match the live perf panel style: dark background, title top-left, legend top-right (or under the title when crowded), friendly labels (3060 not 3060 Ti, yolo11(large) not yolo11l), data-zone labels under each segment when the chart is split across hosts.
- **Hero images** for posts about a comparison should put the comparison front and center: e.g., zoomed-in cars side-by-side with the resolution gap visible. Don't show full thumbnails when the resolution gap is what matters; crop in.
- **Comparison images** elsewhere in the post should reuse the same crop recipe as the hero, so a reader sees the same framing throughout. For camwatch, that's a center crop keeping the middle 60% horizontally and 70% vertically of each source thumb.
- **Honest upsampling**: when blowing up a low-res thumb for visual comparison, use NEAREST so the pixelation is real; LANCZOS on the high-res side. If you smooth the low-res one with bicubic, the comparison lies.
- **Label style**: "Before" in orange, "After" in blue, followed by metadata on the same line (hardware · model · native resolution). Same style across hero and inline comparison.
