import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['**/node_modules/', '**/dist/', '**/build/', '**/.next/', '**/coverage/'],
    },
    eslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        extends: [tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            // Breathing room: blank line around control flow, returns and declaration blocks.
            'padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: '*',
                    next: ['return', 'throw', 'if', 'for', 'while', 'switch', 'try'],
                },
                {
                    blankLine: 'always',
                    prev: ['if', 'for', 'while', 'switch', 'try', 'block-like'],
                    next: '*',
                },
                { blankLine: 'always', prev: ['const', 'let'], next: '*' },
                { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
                { blankLine: 'always', prev: 'directive', next: '*' },
                { blankLine: 'any', prev: 'directive', next: 'directive' },
            ],
        },
    },
    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: { globals: globals.node },
    },
    prettier,
);
