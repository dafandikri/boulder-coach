/** Enforces the layered architecture: domain is pure, data is the only storage seam. */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment: 'src/domain must not import from data or app (no I/O, no UI).',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(data|app)' },
    },
    {
      name: 'data-not-from-app',
      comment: 'src/data (storage) must not depend on app/UI.',
      severity: 'error',
      from: { path: '^src/data' },
      to: { path: '^src/app' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx'] },
  },
};
