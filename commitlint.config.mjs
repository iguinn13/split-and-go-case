export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'test', 'refactor', 'perf', 'build', 'ci', 'chore'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'auth',
        'groups',
        'expenses',
        'balances',
        'settlements',
        'infra',
        'docs',
        'ai',
        'github',
      ],
    ],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
