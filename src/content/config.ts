import { defineCollection, z } from 'astro:content';

const journalCollection = defineCollection({
  type: 'content',
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
  type: 'content',
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

