import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Bare date strings like "2026-05-08" are parsed by JS as UTC
			// midnight, which renders as the previous day in any timezone
			// west of UTC. Anchor them at UTC noon so they display as the
			// intended calendar date everywhere on Earth (and in any
			// timeZone passed to toLocaleDateString downstream).
			pubDate: z.union([z.string(), z.date()]).transform((v) => {
				if (v instanceof Date) return v;
				if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T12:00:00Z');
				return new Date(v);
			}),
			updatedDate: z.union([z.string(), z.date()]).transform((v) => {
				if (v instanceof Date) return v;
				if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T12:00:00Z');
				return new Date(v);
			}).optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
