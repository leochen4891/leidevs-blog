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
