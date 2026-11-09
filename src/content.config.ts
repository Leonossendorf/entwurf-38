import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Freie Texte der Seiten (im Browser-Editor unter /admin bearbeitbar)
const texte = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/texte' }),
  schema: z.object({
    titel: z.string(),
    einleitung: z.string().optional(),
  }),
});

// Neuigkeiten aus dem Club
const aktuelles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/aktuelles' }),
  schema: z.object({
    titel: z.string(),
    datum: z.coerce.date(),
    bild: z.string().optional(),
    bildtext: z.string().optional(),
    kurz: z.string(),
  }),
});

export const collections = { texte, aktuelles };
