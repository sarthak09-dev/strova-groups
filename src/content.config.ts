import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const journalCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    author: z.string().default('Sarthak Shresht'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const workCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    clientName: z.string(),
    clientPermissionConfirmed: z.boolean().default(true),
    problem: z.string(),
    builtSummary: z.string(),
    resultMetric: z.string(),
    resultSource: z.string(),
    screenshotUrl: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  journal: journalCollection,
  work: workCollection,
};
