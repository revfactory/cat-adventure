import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cat-adventure/',
  root: 'src',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
