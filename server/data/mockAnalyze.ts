import { AnalyzeResponse } from '../schemas/analyzeSchema.ts';

export const mockAnalyzeData: AnalyzeResponse = {
  mode: 'sample',
  repository: {
    owner: 'expressjs',
    name: 'express',
    description: 'Fast, unopinionated, minimalist web framework for node.',
    primaryLanguage: 'JavaScript',
    defaultBranch: 'master',
    commitSha: '56e927c8d91a3297a8984920b72ea98c25f1712a',
    stars: 69601,
    technologies: ['Node.js', 'Express', 'Mocha', 'Supertest'],
    entryPoints: ['index.js', 'lib/express.js'],
  },
  conventions: {
    installCommand: 'npm install',
    testCommand: 'npm test',
    lintCommand: 'npm run lint',
    commitStyle: 'Conventional commits (e.g., fix(router): handle empty query param)',
    sources: ['package.json', 'CONTRIBUTING.md'],
  },
  issueAnalysis: {
    summary: 'Query parser throws an unhandled TypeError when encountering nested array parameter with prototype keys in query string.',
    expectedBehavior: 'Parser should ignore prototype properties or return a sanitized object without throwing an unhandled exception.',
    actualBehavior: 'TypeError: Cannot set property __proto__ of #<Object> at parseQuery (lib/middleware/query.js:42).',
    missingInformation: [
      'Specific Node.js runtime version where the regression occurred',
      'Whether qs or simple query parser configuration is active',
    ],
  },
  relevantFiles: [
    {
      path: 'lib/middleware/query.js',
      reason: 'Directly implements the Express query parsing middleware attached to the router pipeline.',
      confidence: 'high',
      evidence: [
        {
          startLine: 38,
          endLine: 45,
          quote: 'var parse = typeof queryparse === "function" ? queryparse : qs.parse;',
          permalink: 'https://github.com/expressjs/express/blob/56e927c8d91a3297a8984920b72ea98c25f1712a/lib/middleware/query.js#L38-L45',
        },
      ],
      verified: true,
    },
    {
      path: 'lib/router/index.js',
      reason: 'Dispatches incoming HTTP requests to registered middleware layers and error handlers.',
      confidence: 'medium',
      evidence: [
        {
          startLine: 120,
          endLine: 128,
          quote: 'proto.handle = function handle(req, res, out) {',
          permalink: 'https://github.com/expressjs/express/blob/56e927c8d91a3297a8984920b72ea98c25f1712a/lib/router/index.js#L120-L128',
        },
      ],
      verified: true,
    },
    {
      path: 'test/res.query.js',
      reason: 'Contains existing test suites verifying query string deserialization edge cases.',
      confidence: 'medium',
      evidence: [
        {
          startLine: 15,
          endLine: 24,
          quote: 'describe("req.query", function () { it("should support complex nesting", function (done) {',
          permalink: 'https://github.com/expressjs/express/blob/56e927c8d91a3297a8984920b72ea98c25f1712a/test/res.query.js#L15-L24',
        },
      ],
      verified: true,
    },
  ],
  codeFlow: [
    {
      step: '1. Request enters router dispatch in lib/router/index.js',
      path: 'lib/router/index.js',
      startLine: 120,
      endLine: 130,
      verified: true,
    },
    {
      step: '2. Query middleware extracts raw query string and invokes query parser',
      path: 'lib/middleware/query.js',
      startLine: 38,
      endLine: 45,
      verified: true,
    },
    {
      step: '3. Query parameters are populated onto req.query for downstream route handlers',
      path: 'lib/middleware/query.js',
      startLine: 48,
      endLine: 54,
      verified: true,
    },
  ],
  investigationPlan: [
    'Inspect lib/middleware/query.js to verify how queryparser options are passed from app settings.',
    'Reproduce the issue by crafting a minimal test case in test/res.query.js sending a malformed prototype key payload.',
    'Check if the qs library dependency version handles prototype pollution or if custom sanitization is required.',
    'Run npm test to ensure existing query suite passes without regressions.',
  ],
  testingChecklist: {
    existingTestsToInspect: [
      'test/res.query.js (contains baseline query parsing tests)',
      'test/app.router.js (verifies middleware chain integrity)',
    ],
    edgeCases: [
      'Payload with ?__proto__[admin]=true',
      'Payload with deeply nested bracket syntax ?a[b][c][d]=1',
      'Payload with empty array indices ?items[]=',
    ],
    regressionIdeas: [
      'Verify that standard string query parameters (?search=test) continue to parse without performance penalty',
      'Verify custom query parser function overrides remain supported',
    ],
    commandsToTry: [
      'npm test',
      'npm run lint',
      'mocha test/res.query.js',
    ],
  },
  contributionFit: {
    level: 'easy',
    effortEstimate: '1–2 hours',
    reasons: [
      'Isolated scope: primarily affects a single middleware file (lib/middleware/query.js)',
      'High existing test coverage in test/res.query.js to guide test-driven verification',
      'Clear expected behavior without architectural changes to the core router',
    ],
  },
  prKit: {
    branchName: 'fix/query-parser-prototype-sanitization',
    commitMessage: 'fix(query): sanitize prototype keys in query middleware',
    prDescriptionDraft: '### Summary\nFixes TypeError caused by prototype pollution keys in nested query strings.\n\n### Changes\n- Updated query parsing logic in `lib/middleware/query.js`.\n- Added regression test in `test/res.query.js`.\n\n### Checklist\n- [ ] Added unit test covering issue payload\n- [ ] Verified existing query tests pass\n- [ ] Followed project commit message style',
    disclaimer: 'DRAFT — edit before using',
  },
  glossary: [
    {
      term: 'Middleware',
      definition: 'A function in Express that has access to the request object (req), the response object (res), and the next function in the application’s request-response cycle.',
    },
    {
      term: 'Query String',
      definition: 'The part of a uniform resource locator (URL) assigning values to specified parameters (e.g., ?key=value).',
    },
    {
      term: 'Prototype Pollution',
      definition: 'A vulnerability where an attacker can modify the prototype of base JavaScript objects, potentially affecting application behavior.',
    },
  ],
  honesty: {
    verifiedFacts: [
      'lib/middleware/query.js is the designated middleware for query string parsing in the repository.',
      'npm test and npm run lint are the declared test and verification scripts in package.json.',
      'Head commit pinned to 56e927c8d91a3297a8984920b72ea98c25f1712a.',
    ],
    hypotheses: [
      'The issue may be mitigated either in Express query middleware or by upgrading the upstream qs parser configuration.',
    ],
    missingContext: [
      'Upstream qs options configuration documentation for custom parsers.',
    ],
    limitations: [
      'Analysis is performed against static source snapshot without runtime execution of mocha test suites.',
    ],
  },
  diagnostics: {
    filesFetched: 4,
    filesCited: 3,
    citationsDropped: 0,
    truncated: false,
    timingMs: 420,
  },
};
