import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/core/validation.ts'], // beide Entry Points
    format: ['esm', 'cjs'], // beide Formate
    dts: true,              // TypeScript Typen generieren
    splitting: false,       // keine Code-Splitting für Libraries
    clean: true,
    outDir: 'dist',
    target: 'es2022',
    minify: false,
});