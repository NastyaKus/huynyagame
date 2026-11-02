import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Сканирует public/assets и отдаёт список файлов как виртуальный модуль.
 * Игра подгружает только реально существующие ассеты, остальное рисуется процедурно.
 */
function assetManifest(): Plugin {
  const id = 'virtual:asset-manifest';
  const resolved = '\0' + id;
  const root = join(process.cwd(), 'public', 'assets');
  const walk = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.(png|jpe?g|webp|ogg|mp3|wav|m4a)$/i.test(name) ? [relative(root, p).split('\\').join('/')] : [];
    });
  };
  return {
    name: 'asset-manifest',
    resolveId: (s) => (s === id ? resolved : null),
    load: (s) => (s === resolved ? `export default ${JSON.stringify(walk(root))};` : null),
    configureServer(server) {
      server.watcher.add(root);
      const reload = (file: string) => {
        if (!file.startsWith(root)) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [assetManifest()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
