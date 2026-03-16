import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const wasmDir = resolve(__dirname, 'packages/geo/wasm');
const distWasmDir = resolve(__dirname, 'dist/wasm');

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist/webview',
        lib: {
            entry: resolve(__dirname, 'src/webview/main.ts'),
            formats: ['es'],
            fileName: () => 'webview.js'
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {}
            }
        },
        sourcemap: true,
        minify: 'esbuild',
        emptyOutDir: true
    },
    worker: {
        format: 'es'
    },
    resolve: {
        alias: {
            '@cadtool-online/core': resolve(__dirname, 'packages/core/src'),
            '@cadtool-online/geo': resolve(__dirname, 'packages/geo/src'),
            '@cadtool-online/three': resolve(__dirname, 'packages/three/src'),
            '@cadtool-online/ui': resolve(__dirname, 'packages/ui/src')
        }
    },
    plugins: [
        {
            name: 'copy-wasm',
            closeBundle() {
                if (!existsSync(distWasmDir)) {
                    mkdirSync(distWasmDir, { recursive: true });
                }
                const wasmFiles = ['cad-geo.js', 'cad-geo.wasm', 'cad-geo.d.ts'];
                for (const file of wasmFiles) {
                    const src = resolve(wasmDir, file);
                    const dest = resolve(distWasmDir, file);
                    if (existsSync(src)) {
                        copyFileSync(src, dest);
                        console.log(`Copied ${file} to dist/wasm/`);
                    }
                }
            }
        }
    ]
});
