// @ts-check
import { defineConfig } from 'astro/config';

// Static Astro site with Cloudflare Pages Functions for API calls.
// See CLAUDE.md for architecture notes.
// https://astro.build/config
export default defineConfig({
  site: 'https://matthewrkenney.com',
  output: 'static',
});