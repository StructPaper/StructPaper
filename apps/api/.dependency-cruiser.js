/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies within the API application are strictly forbidden',
      from: {
        path: '^src',
      },
      to: {
        circular: true,
        path: '^src',
      },
    },
    {
      name: 'domain-layer-purity',
      severity: 'error',
      comment: 'Domain layer must not depend on application, presentation, or infrastructure',
      from: {
        path: '(^|/)domain/',
      },
      to: {
        path: '(^|/)(application|presentation|infrastructure)/',
      },
    },
    {
      name: 'application-layer-boundaries',
      severity: 'error',
      comment: 'Application layer may only depend on domain; cannot import presentation or infrastructure',
      from: {
        path: '(^|/)application/',
      },
      to: {
        path: '(^|/)(presentation|infrastructure)/',
      },
    },
    {
      name: 'presentation-layer-boundaries',
      severity: 'error',
      comment: 'Presentation layer must not depend directly on infrastructure',
      from: {
        path: '(^|/)presentation/',
      },
      to: {
        path: '(^|/)infrastructure/',
      },
    },
    {
      name: 'infrastructure-layer-boundaries',
      severity: 'error',
      comment: 'Infrastructure layer must not depend on presentation',
      from: {
        path: '(^|/)infrastructure/',
      },
      to: {
        path: '(^|/)presentation/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: '(node_modules|packages|\\.\\./\\.\\./packages)',
    },
    exclude: {
      path: '(node_modules|dist|test)',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
