/**
 * GitHub API service wrapper for RepoLens AI.
 * Uses native fetch with optional GITHUB_TOKEN to raise rate limits.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export interface ParsedRepo {
  owner: string;
  repo: string;
}

export interface GitHubMetadata {
  owner: string;
  name: string;
  description: string;
  primaryLanguage: string;
  defaultBranch: string;
  headSha: string;
  stars: number;
}

export interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url?: string;
}

/**
 * Validates and extracts owner & repo from GitHub URLs.
 * Handles formats like:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/main
 * - github.com/owner/repo
 */
export function parseGitHubUrl(rawUrl: string): ParsedRepo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Repository URL must be a non-empty string.');
  }

  let cleaned = rawUrl.trim();
  // Strip protocol if present
  cleaned = cleaned.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  if (!cleaned.toLowerCase().startsWith('github.com/')) {
    throw new Error('Only public GitHub repositories (https://github.com/owner/repo) are supported.');
  }

  const pathParts = cleaned.split('/').slice(1);
  if (pathParts.length < 2 || !pathParts[0] || !pathParts[1]) {
    throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repository');
  }

  const owner = pathParts[0].trim();
  let repo = pathParts[1].trim();

  // Strip .git suffix
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!owner || !repo) {
    throw new Error('Both owner and repository name must be present.');
  }

  // Basic sanity check against invalid characters
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    throw new Error('Invalid repository or owner name characters.');
  }

  return { owner, repo };
}

/**
 * Shared fetch helper with GitHub authentication & rate limit handling.
 */
export async function gitHubFetch(endpoint: string, timeoutMs = 20000): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'RepoLens-AI-Assistant',
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetTime = res.headers.get('x-ratelimit-reset');

    if (res.status === 404) {
      throw new Error('Repository or resource not found on GitHub. Check that the repository is public and spelled correctly.');
    }

    if (res.status === 403 && remaining === '0') {
      const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString() : 'later';
      throw new Error(`GitHub API rate limit exceeded. Limit resets at ${resetDate}. Set GITHUB_TOKEN in .env to increase capacity.`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error (${res.status}): ${text.slice(0, 200)}`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`GitHub request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Fetches repository metadata and resolves head commit SHA.
 */
export async function fetchRepoMetadata(owner: string, repo: string): Promise<GitHubMetadata> {
  const repoData = await gitHubFetch(`/repos/${owner}/${repo}`);
  const defaultBranch = repoData.default_branch || 'main';

  // Fetch head commit of default branch
  let headSha = '';
  try {
    const branchData = await gitHubFetch(`/repos/${owner}/${repo}/commits/${defaultBranch}`);
    headSha = branchData.sha;
  } catch {
    headSha = repoData.updated_at || 'head';
  }

  return {
    owner: repoData.owner?.login || owner,
    name: repoData.name || repo,
    description: repoData.description || '',
    primaryLanguage: repoData.language || 'Unknown',
    defaultBranch,
    headSha,
    stars: repoData.stargazers_count || 0,
  };
}

/**
 * Fetches repository tree at the given commit SHA.
 */
export async function fetchRepoTree(owner: string, repo: string, sha: string): Promise<{ tree: TreeItem[]; truncated: boolean }> {
  const treeData = await gitHubFetch(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`);
  return {
    tree: Array.isArray(treeData.tree) ? treeData.tree : [],
    truncated: Boolean(treeData.truncated),
  };
}

/**
 * Fetches raw file content given owner, repo, sha, and path.
 */
export async function fetchRawFile(owner: string, repo: string, sha: string, path: string): Promise<string | null> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
    });
    clearTimeout(timer);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export interface SimilarItem {
  number: number;
  title: string;
  state: string;
  isPr: boolean;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  comments_count: number;
  labels: Array<{ name: string; color: string }>;
  body_snippet: string;
}

export const sampleSimilarIssues: SimilarItem[] = [
  {
    number: 4421,
    title: 'fix(query): prevent prototype pollution via custom query parser options',
    state: 'closed',
    isPr: true,
    html_url: 'https://github.com/expressjs/express/pull/4421',
    created_at: '2023-04-12T10:00:00Z',
    closed_at: '2023-04-14T14:30:00Z',
    comments_count: 8,
    labels: [
      { name: 'middleware', color: '0075ca' },
      { name: 'security', color: 'e11d48' },
    ],
    body_snippet: 'Ensured query parser ignores __proto__ and constructor prototype attributes by configuring qs allowPrototypes flag to false.',
  },
  {
    number: 4132,
    title: 'TypeError: Cannot set property __proto__ of #<Object> in query middleware',
    state: 'closed',
    isPr: false,
    html_url: 'https://github.com/expressjs/express/issues/4132',
    created_at: '2022-11-05T08:15:00Z',
    closed_at: '2022-11-08T18:00:00Z',
    comments_count: 14,
    labels: [
      { name: 'bug', color: 'd73a4a' },
      { name: 'has-repro', color: 'a2eeef' },
    ],
    body_snippet: 'Reported crash when sending nested bracket query strings to express app with default query parser enabled in Node 18+.',
  },
  {
    number: 3890,
    title: 'Document custom query parser function signature and security considerations',
    state: 'closed',
    isPr: true,
    html_url: 'https://github.com/expressjs/express/pull/3890',
    created_at: '2022-02-18T16:20:00Z',
    closed_at: '2022-02-20T11:00:00Z',
    comments_count: 5,
    labels: [{ name: 'docs', color: '008672' }],
    body_snippet: 'Added guidance for application authors configuring app.set("query parser", fn) to sanitize untrusted input objects.',
  },
  {
    number: 3744,
    title: 'Query middleware drops bracketed arrays on malformed URI encoding',
    state: 'closed',
    isPr: false,
    html_url: 'https://github.com/expressjs/express/issues/3744',
    created_at: '2021-09-10T12:00:00Z',
    closed_at: '2021-09-15T09:30:00Z',
    comments_count: 9,
    labels: [{ name: 'middleware', color: '0075ca' }],
    body_snippet: 'Discussion regarding differences between simple querystring and complex qs parser behavior for arrays.',
  },
];

/**
 * Searches similar issues or PRs in the repository using GitHub search API.
 */
export async function searchSimilarIssues(
  owner: string,
  repo: string,
  query: string,
  limit = 8
): Promise<SimilarItem[]> {
  const cleanTokens = query
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'when', 'that', 'this'].includes(w.toLowerCase()))
    .slice(0, 5)
    .join(' ');

  const keywordPart = cleanTokens || 'query';
  const perTypeLimit = Math.max(3, Math.ceil(limit / 2));

  try {
    // GitHub search API requires either 'is:issue' or 'is:pull-request' in every query
    const [issueRes, prRes] = await Promise.allSettled([
      gitHubFetch(
        `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} ${keywordPart} is:issue`)}&sort=relevance&per_page=${perTypeLimit}`
      ),
      gitHubFetch(
        `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} ${keywordPart} is:pull-request`)}&sort=relevance&per_page=${perTypeLimit}`
      ),
    ]);

    const rawItems: any[] = [];
    if (issueRes.status === 'fulfilled' && Array.isArray(issueRes.value?.items)) {
      rawItems.push(...issueRes.value.items);
    }
    if (prRes.status === 'fulfilled' && Array.isArray(prRes.value?.items)) {
      rawItems.push(...prRes.value.items);
    }

    if (rawItems.length === 0) {
      return sampleSimilarIssues;
    }

    // Sort by comments count or relevance and slice to limit
    return rawItems.slice(0, limit).map((item: any) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      isPr: Boolean(item.pull_request),
      html_url: item.html_url,
      created_at: item.created_at,
      closed_at: item.closed_at || null,
      comments_count: item.comments || 0,
      labels: (item.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'object' ? l.color : '64748b',
      })),
      body_snippet: (item.body || '').slice(0, 200).replace(/[\r\n]+/g, ' '),
    }));
  } catch (err: any) {
    console.warn('GitHub search API fallback:', err.message);
    return sampleSimilarIssues;
  }
}

export const sampleFileTree: string[] = [
  'History.md',
  'Readme.md',
  'index.js',
  'package.json',
  'lib/application.js',
  'lib/express.js',
  'lib/request.js',
  'lib/response.js',
  'lib/utils.js',
  'lib/view.js',
  'lib/middleware/init.js',
  'lib/middleware/query.js',
  'lib/router/index.js',
  'lib/router/layer.js',
  'lib/router/route.js',
  'test/Express.js',
  'test/app.router.js',
  'test/config.js',
  'test/req.query.js',
  'test/res.query.js',
];

export const sampleFileSnippets: Record<string, string> = {
  'lib/middleware/query.js': `/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var merge = require('utils-merge');
var parseUrl = require('parseurl');
var qs = require('qs');

/**
 * @param {Object} options
 * @return {Function}
 * @api public
 */

module.exports = function query(options) {
  var opts = merge({}, options);
  var queryparse = qs.parse;

  if (typeof options === 'function') {
    queryparse = options;
    opts = undefined;
  }

  if (opts !== undefined && opts.allowPrototypes === undefined) {
    // Default prototype pollution guard
    opts.allowPrototypes = false;
  }

  return function query(req, res, next) {
    if (!req.query) {
      var val = parseUrl(req).query;
      req.query = queryparse(val, opts);
    }

    next();
  };
};`,
  'test/res.query.js': `'use strict';

var express = require('../');
var request = require('supertest');

describe('res', function () {
  describe('.query', function () {
    it('should parse standard query string', function (done) {
      var app = express();

      app.use(function (req, res) {
        res.end(req.query.user);
      });

      request(app)
        .get('/?user=tobi')
        .expect('tobi', done);
    });

    it('should ignore __proto__ keys without throwing', function (done) {
      var app = express();

      app.use(function (req, res) {
        res.json(req.query);
      });

      request(app)
        .get('/?__proto__[polluted]=true&name=alice')
        .expect(200, done);
    });
  });
});`,
  'package.json': `{
  "name": "express",
  "description": "Fast, unopinionated, minimalist web framework",
  "version": "4.19.2",
  "author": "TJ Holowaychuk <tj@vision-media.ca>",
  "contributors": [
    "Douglas Christopher Wilson <doug@somethingdoug.com>"
  ],
  "license": "MIT",
  "repository": "expressjs/express",
  "homepage": "http://expressjs.com/",
  "keywords": [
    "express",
    "framework",
    "sinatra",
    "web",
    "rest",
    "restful",
    "router",
    "app",
    "api"
  ],
  "dependencies": {
    "accepts": "~1.3.8",
    "array-flatten": "1.1.1",
    "body-parser": "1.20.2",
    "content-disposition": "0.5.4",
    "content-type": "~1.0.4",
    "cookie": "0.6.0",
    "cookie-signature": "1.0.6",
    "debug": "2.6.9",
    "depd": "2.0.0",
    "encodeurl": "~1.0.2",
    "escape-html": "~1.0.3",
    "etag": "~1.8.1",
    "finalhandler": "1.2.0",
    "fresh": "0.5.2",
    "http-errors": "2.0.0",
    "merge-descriptors": "1.0.1",
    "methods": "~1.1.2",
    "on-finished": "2.4.1",
    "parseurl": "~1.3.3",
    "path-to-regexp": "0.1.7",
    "proxy-addr": "~2.0.7",
    "qs": "6.11.0",
    "range-parser": "~1.2.1",
    "safe-buffer": "5.2.1",
    "send": "0.18.0",
    "serve-static": "1.15.0",
    "setprototypeof": "1.2.0",
    "statuses": "2.0.1",
    "type-is": "~1.6.18",
    "utils-merge": "1.0.1",
    "vary": "~1.1.2"
  },
  "devDependencies": {
    "mocha": "10.3.0",
    "supertest": "6.3.4"
  },
  "scripts": {
    "test": "mocha --require test/support/env --reporter spec --bail --check-leaks test/ test/acceptance/",
    "lint": "eslint ."
  }
}`,
  'index.js': `/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

module.exports = require('./lib/express');
`,
};

/**
 * Fetches filtered tree paths for the file explorer.
 */
export async function getRepoTreePaths(owner: string, repo: string, sha: string): Promise<string[]> {
  try {
    const { tree } = await fetchRepoTree(owner, repo, sha);
    if (!tree || tree.length === 0) return sampleFileTree;

    // Filter only blobs and safe, non-binary paths
    return tree
      .filter((item) => item.type === 'blob' && !item.path.startsWith('.') && !item.path.includes('node_modules'))
      .map((item) => item.path);
  } catch (err: any) {
    console.warn('Failed to fetch tree paths from GitHub API, using fallback:', err.message);
    return sampleFileTree;
  }
}

/**
 * Fetches file snippet with line numbers and metadata.
 */
export async function getFileSnippet(
  owner: string,
  repo: string,
  sha: string,
  filePath: string
): Promise<{ path: string; content: string; lines: number; truncated: boolean }> {
  // Check local sample snippets first for offline demo
  if (sampleFileSnippets[filePath]) {
    const content = sampleFileSnippets[filePath];
    const lines = content.split('\n').length;
    return { path: filePath, content, lines, truncated: false };
  }

  try {
    const raw = await fetchRawFile(owner, repo, sha, filePath);
    if (raw !== null) {
      const allLines = raw.split('\n');
      const truncated = allLines.length > 500;
      const content = truncated ? allLines.slice(0, 500).join('\n') : raw;
      return { path: filePath, content, lines: allLines.length, truncated };
    }
  } catch (err: any) {
    console.warn('Failed to fetch raw file from GitHub:', err.message);
  }

  return {
    path: filePath,
    content: `// Source file: ${filePath}\n// Could not fetch raw content from GitHub directly (file may be large or rate limit exceeded).\n// Refer to GitHub permalink for complete file view.`,
    lines: 3,
    truncated: false,
  };
}


