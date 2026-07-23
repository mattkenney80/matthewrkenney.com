// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://matthewrkenney.com',
  // SSR on Cloudflare Workers: pages render on-demand so admin-controlled
  // nav visibility and per-article publish state take effect immediately.
  output: 'server',
  adapter: cloudflare(),
});