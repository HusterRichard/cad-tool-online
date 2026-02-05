import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist/webview',
        lib: {
            entry: resolve(__dirname, 'src/webview/main.ts'),
            name: 'CadToolWebview',
            formats: ['iife'],
            fileName: () => 'webview.js'
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {}
            }
        },
        sourcemap: true,
        minify: 'esbuild'
    },
    resolve: {
        alias: {
            '@cadtool-online/core': resolve(__dirname, '../core/src'),
            '@cadtool-online/geo': resolve(__dirname, '../geo/src'),
            '@cadtool-online/three': resolve(__dirname, '../three/src'),
            '@cadtool-online/ui': resolve(__dirname, '../ui/src')
        }
    }
});
