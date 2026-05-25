import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function copyDemoPlugin(): Plugin {
  return {
    name: 'copy-demo-assets',
    closeBundle() {
      const source = path.resolve(__dirname, 'demo');
      const outDir = process.env.GITHUB_PAGES === 'true' ? 'docs' : 'dist';
      const target = path.resolve(__dirname, outDir, 'demo');
      if (!fs.existsSync(source)) return;
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(source, target, {
        recursive: true,
        filter: (file: string) => path.basename(file) !== '.DS_Store'
      });
    }
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/photo_align/' : '/',
  build: {
    outDir: process.env.GITHUB_PAGES === 'true' ? 'docs' : 'dist'
  },
  plugins: [react(), copyDemoPlugin()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
});
