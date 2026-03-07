module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    node: true,
    es2021: true,
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    {
      files: ['src/contexts/**/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '@nestjs/*',
              '@prisma/client',
              '**/prisma/**',
              '**/modules/**',
              '**/tenancy/**',
              'stripe',
              'twilio',
              'openai',
              'firebase-admin',
              'nodemailer',
              'imagekit',
            ],
          },
        ],
      },
    },
    {
      files: ['src/contexts/**/application/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '@nestjs/*',
              '@prisma/client',
              '**/prisma/**',
              '**/modules/**',
              '**/tenancy/**',
              '**/infrastructure/**',
              'stripe',
              'twilio',
              'openai',
              'firebase-admin',
              'nodemailer',
              'imagekit',
            ],
          },
        ],
      },
    },
  ],
};
