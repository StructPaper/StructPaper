/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-doc-model-contamination',
      comment:
        'packages/doc-model must NOT import anything from react, react-dom, DOM, apps/*, or sibling packages.',
      severity: 'error',
      from: {
        path: '^packages/doc-model',
      },
      to: {
        path: '(react|react-dom|apps/|packages/(?!doc-model))',
      },
    },
    {
      name: 'strict-downward-dependencies',
      comment:
        'packages/ingest-docx, packages/exporters, packages/qc-engine, packages/editor-core must only depend on packages/doc-model and packages/journal-profiles.',
      severity: 'error',
      from: {
        path: '^packages/(ingest-docx|exporters|qc-engine|editor-core)',
      },
      to: {
        path: '^(apps/|packages/(?!doc-model|journal-profiles|\\1))',
      },
    },
    {
      name: 'storage-downward-dependencies',
      comment:
        'packages/storage must only depend on packages/doc-model and packages/editor-core.',
      severity: 'error',
      from: {
        path: '^packages/storage',
      },
      to: {
        path: '^(apps/|packages/(?!doc-model|editor-core|storage))',
      },
    },
    {
      name: 'compiler-client-boundaries',
      comment:
        'packages/compiler-client must NOT import react, react-dom, apps/*, or sibling packages (except doc-model).',
      severity: 'error',
      from: {
        path: '^packages/compiler-client',
      },
      to: {
        path: '(react|react-dom|apps/|packages/(?!doc-model|compiler-client))',
      },
    },
    {
      name: 'domain-layer-purity',
      comment: 'Domain layer in apps/api must not depend on application, presentation, or infrastructure',
      severity: 'error',
      from: {
        path: '^apps/api/src/domain/',
      },
      to: {
        path: '^apps/api/src/(application|presentation|infrastructure)/',
      },
    },
    {
      name: 'application-layer-boundaries',
      comment: 'Application layer in apps/api may only depend on domain; cannot import presentation or infrastructure',
      severity: 'error',
      from: {
        path: '^apps/api/src/application/',
      },
      to: {
        path: '^apps/api/src/(presentation|infrastructure)/',
      },
    },
    {
      name: 'presentation-layer-boundaries',
      comment: 'Presentation layer in apps/api must not depend directly on infrastructure',
      severity: 'error',
      from: {
        path: '^apps/api/src/presentation/',
      },
      to: {
        path: '^apps/api/src/infrastructure/',
      },
    },
    {
      name: 'infrastructure-layer-boundaries',
      comment: 'Infrastructure layer in apps/api must not depend on presentation',
      severity: 'error',
      from: {
        path: '^apps/api/src/infrastructure/',
      },
      to: {
        path: '^apps/api/src/presentation/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: '(node_modules|\\.next)',
    },
    exclude: {
      path: '(node_modules|\\.next|dist)',
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
