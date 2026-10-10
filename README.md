# RepoLens AI

> **Tagline:** Understand the code. Find your path. Make your contribution.

RepoLens AI is an **issue-first contribution copilot** for open-source GitHub repositories. Given a public repository and an issue, RepoLens produces an **evidence-backed contribution guide**: what the issue actually means, which files to inspect first and why, how relevant code flows, an actionable investigation plan, and how to verify changes without guessing.

RepoLens operates under a core philosophy: **it guides contributors**. It never claims to solve issues autonomously, never mutates code behind your back, and never hallucinates file paths or test executions.

---

## The Problem & The Solution

- **The Problem:** Contributing to unfamiliar open-source projects is intimidating. First-time contributors spend hours reading unrelated files, struggling with massive directory structures, guessing where bug causes originate, and running into hallucinations when using generic chat models that fabricate function names and non-existent paths.
- **The Solution:** RepoLens pins a specific commit SHA of the target repository, extracts filtered file trees and targeted excerpts, enforces server-side line-by-line validation, and guarantees that every cited path, line range, and code quote actually exists in the fetched snapshot.

---

## Architectural Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RepoLens Client (React)                         │
│  - Repository Intake  - Issue Form  - Beginner Mode  - Evidence Views   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/analyze
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         RepoLens Server (Node.js)                      │
│                                                                        │
│  1. URL Parser & GitHub Metadata Resolver                             │
│     ├── Validates owner/repo & resolves head commit SHA                │
│     └── Fetches tree (excluding node_modules, lockfiles, secrets)      │
│                                                                        │
│  2. Context Builder Pipeline (contextBuilder.ts)                       │
│     ├── Filters forbidden extensions & secret files (.env, keys)       │
│     ├── Extracts conventions (CONTRIBUTING, package.json scripts)      │
│     ├── Scores candidate files based on issue keywords & symbols       │
│     └── Excerpts top files with preserved source line numbers          │
│                                                                        │
│  3. Model Client (llmClient.ts via Google Gemini API)                  │
│     ├── Strict system prompt: Treat repo & issue as untrusted data     │
│     └── Request structured JSON following API schema                   │
│                                                                        │
│  4. Server-Side Verifier (verifier.ts)                                 │
│     ├── Validates JSON with Zod                                        │
│     ├── Tree Allowlist Check: drops files not in actual git tree       │
│     ├── Content & Line Range Check: verifies line bounds & quotes      │
│     ├── Strips false test execution claims                             │
│     └── Generates pinned GitHub commit permalinks                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Verified Contribution Guide Response                   │
│  - Issue Breakdown  - Ranked Files + Evidence  - Code Flow             │
│  - Investigation Plan  - Testing Checklist  - Honesty Panel            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Roadmap & Status

| Feature | Tier | Status | Description |
| :--- | :--- | :--- | :--- |
| **Repo Intake & Tree Inspection** | Tier 0 (MVP) | In Progress | Validates GitHub URL, fetches tree, detects tech stack & entry points |
| **Issue Analysis & Keyword Extraction** | Tier 0 (MVP) | In Progress | Parses issue title and description, extracts tokens & identifiers |
| **Evidence-Grounded File Ranking** | Tier 0 (MVP) | Completed | Ranks candidate files with reasons, confidence, and line quotes |
| **Interactive File Explorer** | Tier 1 | Completed | Expandable repository tree with in-app snippet viewer and candidate line highlights |
| **Code Flow Step-by-Step** | Tier 0 (MVP) | Completed | Step-by-step trace referencing verified file and line locations |
| **Investigation Plan & Testing Checklist** | Tier 0 (MVP) | Completed | Specific checklist of files to inspect and commands to run |
| **Honesty Panel** | Tier 0 (MVP) | Completed | Explicit breakdown of Verified Facts, Hypotheses, Missing Context |
| **Full PDF Report Export** | Tier 1 | Completed | Programmatically generates and downloads standalone multi-page PDF report |
| **Gemini Multi-Turn Copilot Chat** | Tier 1 | Completed | Interactive grounded Q&A with personas (Navigator, Test Engineer, PR Reviewer) |
| **Evidence Permalinks** | Tier 1 | Planned | Direct links to `github.com/.../blob/{sha}/{path}#L{start}-L{end}` |
| **Issue URL Direct Fetch** | Tier 1 | Planned | Fetch issue title/body/labels directly from GitHub issue URL |
| **Repo Conventions Card** | Tier 1 | Planned | Discovers install/test/lint commands from repo config and guides |
| **Contribution Fit Score** | Tier 1 | Planned | Evaluates difficulty (`Easy \| Medium \| Hard`) with evidence reasons |
| **Beginner Mode Toggle** | Tier 1 | Planned | Simplifies technical jargon and provides an inline glossary |
| **Draft PR Kit & Checklist** | Tier 1 | Completed | Generates branch/commit/PR outline and interactive pre-flight checklist |
| **Similar Issues & PRs** | Tier 1 | Completed | Searches GitHub API for adjacent repository issues/PRs to provide prior-art context |
| **Targeted Q&A** | Tier 1 | Planned | Direct questions answered using the verified retrieval pipeline |
| **Good First Issue Finder** | Tier 2 | Stretch | Discovers open starter issues from GitHub repository |

---

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS, Lucide Icons
- **Backend:** Node.js 22+, Express, `tsx`
- **Validation:** Zod 4
- **AI Engine:** Google Gemini Flash (`@google/genai` SDK on server side)
- **External APIs:** GitHub REST API (public endpoints with optional PAT for elevated rate limits)

---

## Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for server-side generation (configured in AI Studio Secrets) |
| `GITHUB_TOKEN` | Optional | GitHub Personal Access Token (no scopes required) to raise rate limit from 60 to 5,000 req/hr |
| `PORT` | Optional | Port for the backend server (defaults to `3000`) |

---

## Security & Anti-Hallucination Design

1. **Untrusted Data Isolation:**
   - All repository contents (code, README, issue descriptions, templates) are encapsulated inside designated `<repo_context>` and `<issue>` data blocks.
   - The model is instructed to treat all inputs as untrusted data and ignore prompt injections.
2. **Secret Redaction:**
   - Any sensitive file (`.env*`, `*.key`, `*.pem`, `id_rsa*`) is filtered out before retrieval.
   - Automatic regex filters redact tokens (e.g., `ghp_...`, `AKIA...`, `sk-...`).
3. **Deterministic Server-Side Verification:**
   - Every file path cited by the model is checked against the actual Git tree.
   - Non-existent paths are pruned and tallied in diagnostics.
   - Line numbers and code snippets are validated against fetched excerpts.
   - All permalinks are computed deterministically on the server pinned to the exact commit SHA.
4. **Honesty by Default:**
   - The system distinguishes between **Verified Facts** (directly observable in retrieved source code) and **Hypotheses** (inferred connections).
   - Never states code executed tests unless an execution harness actually ran them.

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm

### Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and optional GITHUB_TOKEN

# Start development server (serves Express API and Vite frontend on port 3000)
npm run dev
```

---

## License
MIT
