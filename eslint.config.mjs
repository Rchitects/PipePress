import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    // Dateien, die nicht gelintet werden sollen
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'benchmark/**',
            'dist-benchmark/**',
            'example/**',
            'coverage/**',
            'eslint.config.mjs',
            'tsup.config.ts',
            'vitest.config.ts',
            'test/**'
        ],
    },

    // Basis-Regeln
    js.configs.recommended,

    // TypeScript-Regeln mit Type-Checking
    ...tseslint.configs.recommendedTypeChecked,

    // Type-Checking braucht Zugriff auf die tsconfig.json
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Prettier zuletzt, damit es Formatierungs-Konflikte deaktiviert
    eslintConfigPrettier,

    // Eigene Regeln / Overrides
    {
        rules: {
            '@typescript-eslint/no-unused-vars': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            'no-console': 'warn',
        },
    }
);