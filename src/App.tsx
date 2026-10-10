/**
 * RepoLens AI — Issue-First Contribution Copilot
 * Clean developer-tool UI adhering to strict anti-hallucination and evidence presentation principles.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GitPullRequest,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCode2,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Search,
  Download,
  FileDown,
  MessageSquare,
  Send,
  User,
  Bot,
  Printer,
  Clock,
  Star,
  ListChecks,
  CheckSquare,
  Square,
  CircleDot,
  GitMerge,
  MessageCircle,
  Folder,
  FolderOpen,
  File,
  Code,
} from 'lucide-react';
import { SimilarItem } from '@/server/services/github.ts';
import { AnalyzeResponse, RelevantFile, CodeFlowStep, EvidenceItem } from '@/server/schemas/analyzeSchema.ts';
import { generateReportPdf } from './utils/pdfGenerator.ts';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/expressjs/express');
  const [issueTitle, setIssueTitle] = useState('TypeError in query parser with nested prototype keys');
  const [issueDesc, setIssueDesc] = useState(
    'When query parameters contain malformed prototype keys like ?__proto__[polluted]=true, the query middleware throws an unhandled TypeError: Cannot set property __proto__ of #<Object> at parseQuery (lib/middleware/query.js:42). It should sanitize or drop prototype keys safely.'
  );
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stageText, setStageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'flow' | 'plan' | 'prkit' | 'similar' | 'copilot' | 'glossary'>('files');
  const [similarIssues, setSimilarIssues] = useState<SimilarItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarQuery, setSimilarQuery] = useState('');
  const [similarFilter, setSimilarFilter] = useState<'all' | 'issues' | 'prs' | 'closed'>('all');

  // File Explorer State
  const [whereToLookView, setWhereToLookView] = useState<'cards' | 'explorer'>('cards');
  const [treePaths, setTreePaths] = useState<string[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('lib/middleware/query.js');
  const [selectedFileSnippet, setSelectedFileSnippet] = useState<{
    path: string;
    content: string;
    lines: number;
    truncated: boolean;
  } | null>(null);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    lib: true,
    'lib/middleware': true,
    'lib/router': true,
    test: true,
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [copiedPr, setCopiedPr] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Chat Copilot State
  const [chatRole, setChatRole] = useState<'code_navigator' | 'test_engineer' | 'pr_reviewer'>('code_navigator');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Hello! I am your RepoLens Copilot. I have analyzed the repository structure and the reported query parser issue. Ask me about code flow, where to add tests, or how to prepare your PR.',
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Contribution Checklist State
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const checklistItems = React.useMemo(() => {
    if (!data) return [];
    return [
      {
        id: 'run_tests',
        title: `Run existing test suite (${data.conventions.testCommand || 'npm test'})`,
        desc: 'Execute automated regression tests before and after code modifications.',
      },
      ...data.relevantFiles.map((file: RelevantFile, idx: number) => ({
        id: `file_${idx}_${file.path}`,
        title: `Inspect & modify candidate file: ${file.path}`,
        desc: file.reason,
      })),
      ...data.testingChecklist.existingTestsToInspect.slice(0, 2).map((test: string, idx: number) => ({
        id: `test_${idx}_${test}`,
        title: `Verify against test suite: ${test}`,
        desc: 'Confirm new behavior and prevent regressions.',
      })),
      {
        id: 'dev_env_fix',
        title: 'Verified fix in dev environment',
        desc: 'Manually test reproduction payload and confirm expected behavior.',
      },
      {
        id: 'commit_conventions',
        title: `Follow commit style (${data.conventions.commitStyle || 'standard'})`,
        desc: `Prepare branch '${data.prKit.branchName}' according to project conventions.`,
      },
    ];
  }, [data]);

  const treeHierarchy = React.useMemo(() => {
    const root: TreeNode = { name: '', path: '', isFolder: true, children: [] };
    const filtered = treePaths.filter((p: string) =>
      treeSearch ? p.toLowerCase().includes(treeSearch.toLowerCase()) : true
    );

    filtered.forEach((filePath: string) => {
      const parts = filePath.split('/');
      let current = root;

      parts.forEach((part: string, idx: number) => {
        const isLast = idx === parts.length - 1;
        const currentPath = parts.slice(0, idx + 1).join('/');

        if (!current.children) current.children = [];
        let existing = current.children.find((c: TreeNode) => c.name === part);

        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            children: isLast ? undefined : [],
          };
          current.children.push(existing);
        }
        current = existing;
      });
    });

    const sortNodes = (node: TreeNode) => {
      if (!node.children) return;
      node.children.sort((a: TreeNode, b: TreeNode) => {
        if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
        return a.isFolder ? -1 : 1;
      });
      node.children.forEach(sortNodes);
    };

    sortNodes(root);
    return root.children || [];
  }, [treePaths, treeSearch]);

  const toggleChecklistStep = (id: string) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAllSteps = () => {
    const allChecked = checklistItems.reduce((acc, item) => {
      acc[item.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setCheckedSteps(allChecked);
  };

  const handleResetChecklist = () => {
    setCheckedSteps({});
  };

  const completedStepsCount = checklistItems.filter((item) => checkedSteps[item.id]).length;
  const isPrReady = checklistItems.length > 0 && completedStepsCount === checklistItems.length;

  // Check backend health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((h) => setHealthStatus(h))
      .catch((err) => console.error('Health check failed', err));
  }, []);

  // Pre-load sample data on first render for immediate demonstration
  useEffect(() => {
    handleAnalyze(true);
  }, []);

  useEffect(() => {
    if (activeTab === 'copilot') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleAnalyze = async (isSample = false) => {
    setError(null);
    setLoading(true);
    setStageText('Connecting to repository snapshot...');

    try {
      if (!isSample) {
        setStageText('Inspecting repository tree & filtering safe paths...');
        await new Promise((r) => setTimeout(r, 400));
        setStageText('Scoring candidate files & extracting evidence lines...');
        await new Promise((r) => setTimeout(r, 400));
        setStageText('Running server-side verifier & generating permalinks...');
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl: repoUrl,
          issue: {
            title: issueTitle,
            description: issueDesc,
          },
          beginnerMode,
          sample: isSample,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || 'Failed to analyze repository and issue.');
      }

      setData(json);
      fetchSimilarIssues(`${json.repository.owner}/${json.repository.name}`, json.issueAnalysis.summary || issueTitle);
      fetchTree(`${json.repository.owner}/${json.repository.name}`, json.repository.commitSha);
      const initialFile = json.relevantFiles[0]?.path || 'lib/middleware/query.js';
      fetchSnippet(initialFile, `${json.repository.owner}/${json.repository.name}`, json.repository.commitSha);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setStageText('');
    }
  };

  const fetchTree = async (repoOverride?: string, shaOverride?: string) => {
    const targetRepo = repoOverride || (data ? `${data.repository.owner}/${data.repository.name}` : repoUrl);
    const sha = shaOverride || (data ? data.repository.commitSha : 'master');
    setTreeLoading(true);

    try {
      const res = await fetch(
        `/api/repo/tree?repo=${encodeURIComponent(targetRepo)}&sha=${encodeURIComponent(sha)}`
      );
      const json = await res.json();
      if (json.tree && Array.isArray(json.tree)) {
        setTreePaths(json.tree);
      }
    } catch (err) {
      console.error('Failed to fetch tree paths', err);
    } finally {
      setTreeLoading(false);
    }
  };

  const fetchSnippet = async (filePath: string, repoOverride?: string, shaOverride?: string) => {
    setSelectedFilePath(filePath);
    const targetRepo = repoOverride || (data ? `${data.repository.owner}/${data.repository.name}` : repoUrl);
    const sha = shaOverride || (data ? data.repository.commitSha : 'master');
    setSnippetLoading(true);

    try {
      const res = await fetch(
        `/api/repo/file?repo=${encodeURIComponent(targetRepo)}&sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(filePath)}`
      );
      const json = await res.json();
      if (json.ok) {
        setSelectedFileSnippet({
          path: json.path,
          content: json.content,
          lines: json.lines,
          truncated: Boolean(json.truncated),
        });
      }
    } catch (err) {
      console.error('Failed to fetch file snippet', err);
    } finally {
      setSnippetLoading(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const copySnippetToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const fetchSimilarIssues = async (repoOverride?: string, queryOverride?: string) => {
    const targetRepo = repoOverride || (data ? `${data.repository.owner}/${data.repository.name}` : repoUrl);
    const q = queryOverride !== undefined ? queryOverride : (similarQuery || issueTitle || 'query');
    setSimilarLoading(true);

    try {
      const res = await fetch(`/api/similar-issues?repo=${encodeURIComponent(targetRepo)}&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.items) {
        setSimilarIssues(json.items);
      }
    } catch (err) {
      console.error('Failed to fetch similar issues', err);
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!data) return;
    try {
      setIsExportingPdf(true);
      generateReportPdf(data);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      setError('Failed to generate PDF document: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSendChat = async (overrideText?: string) => {
    const textToSend = overrideText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: textToSend.trim() }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          role: chatRole,
          repositoryContext: data
            ? {
                owner: data.repository.owner,
                repo: data.repository.name,
                primaryLanguage: data.repository.primaryLanguage,
                entryPoints: data.repository.entryPoints,
              }
            : undefined,
          issueContext: data
            ? {
                summary: data.issueAnalysis.summary,
                relevantFiles: data.relevantFiles.map((f) => ({ path: f.path, reason: f.reason })),
              }
            : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to receive reply from copilot.');
      }

      setChatMessages((prev) => [...prev, { role: 'model', text: json.text }]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'model', text: `Sorry, I encountered an error: ${err.message || 'Could not connect to model'}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPr(true);
    setTimeout(() => setCopiedPr(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-mono font-bold text-sm">
            RL
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-semibold text-slate-100 tracking-tight text-base">RepoLens AI</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                v0.1-mvp
              </span>
              {data?.mode === 'sample' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 tracking-wide font-mono">
                  SAMPLE DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Understand the code. Find your path. Make your contribution.
            </p>
          </div>
        </div>

        {/* Action Buttons & System Status */}
        <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
          <div className="hidden sm:flex items-center space-x-1.5 mr-2">
            <span
              className={`h-2 w-2 rounded-full ${
                healthStatus?.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>Engine: {healthStatus?.geminiConfigured ? 'Gemini 3.8 Flash' : 'Mock/Offline'}</span>
          </div>

          {data && (
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              title="Download standalone PDF report"
              className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition font-sans cursor-pointer disabled:opacity-50"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Downloaded PDF!</span>
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5 text-blue-400" />
                  <span>Download PDF Report</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => handleAnalyze(true)}
            className="px-2.5 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Sample Demo
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Input Configuration Grid */}
        <section className="bg-slate-900 rounded-lg border border-slate-800 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Repo Input */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono">
                GitHub Repository URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
                />
              </div>
            </div>

            {/* Issue Title Input */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono">
                Issue Title (Optional)
              </label>
              <input
                type="text"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder="Brief summary of the issue or feature"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
              />
            </div>

            {/* Actions / Toggles */}
            <div className="md:col-span-2 space-y-2 pt-5">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={beginnerMode}
                  onChange={(e) => setBeginnerMode(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-slate-200 focus:ring-0"
                />
                <span>Beginner Mode</span>
              </label>

              <button
                disabled={loading || !repoUrl.trim()}
                onClick={() => handleAnalyze(false)}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-white text-slate-950 font-medium text-xs rounded transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Analyze Issue</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Issue Description Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex justify-between">
              <span>Issue Description & Stacktrace (Paste untrusted issue body)</span>
              <span className="text-slate-500">{issueDesc.length} / 8000 chars</span>
            </label>
            <textarea
              rows={3}
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Paste raw issue text, error message, or stacktrace..."
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
            />
          </div>
        </section>

        {/* Stage Loading Indicator */}
        {loading && (
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded flex items-center space-x-3 text-sm text-slate-300">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
            <span className="font-mono text-xs">{stageText}</span>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-200 rounded text-sm flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-xs font-mono uppercase tracking-wide">Analysis Blocked</div>
              <p className="text-xs text-rose-300">{error}</p>
              <button
                onClick={() => handleAnalyze(false)}
                className="mt-2 text-xs text-rose-200 underline hover:text-white"
              >
                Retry Request
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {data && (
          <div className="space-y-6">
            {/* Top Repository Snapshot Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-mono">Repository Snapshot:</span>
                    <a
                      href={`https://github.com/${data.repository.owner}/${data.repository.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base font-semibold text-slate-100 hover:text-blue-400 transition flex items-center space-x-1"
                    >
                      <span>
                        {data.repository.owner}/{data.repository.name}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                    <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">
                      {data.repository.primaryLanguage}
                    </span>
                    {typeof data.repository.stars === 'number' && data.repository.stars > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-amber-300 rounded font-mono border border-slate-700 flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{data.repository.stars.toLocaleString()} stars</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                    {data.repository.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded">
                    <span className="text-slate-500 mr-1.5">PINNED SHA:</span>
                    <span className="text-slate-300">{data.repository.commitSha.slice(0, 8)}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded">
                    <span className="text-slate-500 mr-1.5">FIT:</span>
                    <span
                      className={`font-semibold uppercase ${
                        data.contributionFit.level === 'easy'
                          ? 'text-emerald-400'
                          : data.contributionFit.level === 'medium'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {data.contributionFit.level}
                    </span>
                  </div>
                  {data.contributionFit.effortEstimate && (
                    <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-slate-500">ESTIMATED EFFORT:</span>
                      <span className="text-slate-200 font-semibold">{data.contributionFit.effortEstimate}</span>
                    </div>
                  )}
                  <button
                    onClick={handleDownloadPdf}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-slate-200 flex items-center space-x-1.5 transition cursor-pointer font-sans"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-400" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Conventions & Stack row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-slate-500 font-semibold mb-1">CONVENTIONS DETECTED</div>
                  <div className="text-slate-300">Test: {data.conventions.testCommand || 'Not specified'}</div>
                  <div className="text-slate-400">Install: {data.conventions.installCommand || 'Not specified'}</div>
                  <div className="text-slate-400">Lint: {data.conventions.lintCommand || 'Not specified'}</div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-slate-500 font-semibold mb-1">ENTRY POINTS IDENTIFIED</div>
                  <div className="text-slate-300 flex flex-wrap gap-1">
                    {data.repository.entryPoints.map((ep: string, i: number) => (
                      <span key={i} className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800">
                        {ep}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
                  <div className="text-slate-500 font-semibold mb-1">CONTRIBUTION FIT REASONS</div>
                  <ul className="text-slate-300 space-y-0.5 list-disc list-inside font-sans">
                    {data.contributionFit.reasons.slice(0, 2).map((r: string, i: number) => (
                      <li key={i} className="truncate">{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Issue Summary & Understanding */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <Info className="h-4 w-4 text-slate-400" />
                <span>Issue Breakdown</span>
              </div>
              <h2 className="text-sm font-semibold text-slate-100">{data.issueAnalysis.summary}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.issueAnalysis.expectedBehavior && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="font-mono text-slate-400 block mb-1">EXPECTED BEHAVIOR:</span>
                    <p className="text-slate-300">{data.issueAnalysis.expectedBehavior}</p>
                  </div>
                )}
                {data.issueAnalysis.actualBehavior && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="font-mono text-slate-400 block mb-1">ACTUAL BEHAVIOR:</span>
                    <p className="text-slate-300">{data.issueAnalysis.actualBehavior}</p>
                  </div>
                )}
              </div>

              {data.issueAnalysis.missingInformation.length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded text-xs text-amber-200">
                  <span className="font-mono font-semibold block mb-1">MISSING ISSUE CONTEXT:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-300/90">
                    {data.issueAnalysis.missingInformation.map((info: string, i: number) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Navigation Tabs for Evidence, Planning, Copilot Chat */}
            <div className="flex items-center space-x-1 border-b border-slate-800 text-xs font-mono">
              <button
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer ${
                  activeTab === 'files'
                    ? 'border-slate-200 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Where to Look ({data.relevantFiles.length})
              </button>
              <button
                onClick={() => setActiveTab('flow')}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer ${
                  activeTab === 'flow'
                    ? 'border-slate-200 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Code Flow ({data.codeFlow.length})
              </button>
              <button
                onClick={() => setActiveTab('plan')}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer ${
                  activeTab === 'plan'
                    ? 'border-slate-200 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Investigation & Testing
              </button>
              <button
                onClick={() => setActiveTab('prkit')}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer ${
                  activeTab === 'prkit'
                    ? 'border-slate-200 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Draft PR Kit
              </button>
              <button
                onClick={() => {
                  setActiveTab('similar');
                  if (similarIssues.length === 0) fetchSimilarIssues();
                }}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'similar'
                    ? 'border-indigo-400 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                <span>Similar Issues & PRs {similarIssues.length > 0 ? `(${similarIssues.length})` : ''}</span>
              </button>
              <button
                onClick={() => setActiveTab('copilot')}
                className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'copilot'
                    ? 'border-blue-400 text-blue-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Ask Copilot</span>
              </button>
              {data.glossary.length > 0 && (
                <button
                  onClick={() => setActiveTab('glossary')}
                  className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer ${
                    activeTab === 'glossary'
                      ? 'border-slate-200 text-slate-100'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Glossary ({data.glossary.length})
                </button>
              )}
            </div>

            {/* Tab 1: Relevant Files & Evidence */}
            {activeTab === 'files' && (
              <div className="space-y-4">
                {/* View Mode Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                    <span>View Mode:</span>
                    <div className="bg-slate-950 p-0.5 rounded border border-slate-800 flex items-center space-x-1">
                      <button
                        onClick={() => setWhereToLookView('cards')}
                        className={`px-3 py-1 rounded transition cursor-pointer ${
                          whereToLookView === 'cards'
                            ? 'bg-slate-800 text-slate-100 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Ranked Candidate Cards ({data.relevantFiles.length})
                      </button>
                      <button
                        onClick={() => {
                          setWhereToLookView('explorer');
                          if (treePaths.length === 0) fetchTree();
                          if (!selectedFileSnippet) fetchSnippet(selectedFilePath);
                        }}
                        className={`px-3 py-1 rounded transition flex items-center space-x-1.5 cursor-pointer ${
                          whereToLookView === 'explorer'
                            ? 'bg-slate-800 text-slate-100 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Folder className="h-3.5 w-3.5 text-blue-400" />
                        <span>Interactive File Explorer</span>
                      </button>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-slate-500">
                    {whereToLookView === 'explorer'
                      ? `${treePaths.length} files indexed in repository tree`
                      : `${data.relevantFiles.length} candidate files ranked by evidence`}
                  </span>
                </div>

                {/* Mode 1: Ranked Candidate Cards View */}
                {whereToLookView === 'cards' && (
                  <div className="space-y-4">
                    {data.relevantFiles.map((file: RelevantFile, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <FileCode2 className="h-4 w-4 text-slate-400" />
                            <span className="font-mono text-sm font-semibold text-slate-100">
                              {file.path}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-mono uppercase font-medium ${
                                file.confidence === 'high'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : file.confidence === 'medium'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {file.confidence} confidence
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-mono ${
                                file.verified
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {file.verified ? 'Verified in tree' : 'Unverified path'}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedFilePath(file.path);
                              setWhereToLookView('explorer');
                              fetchSnippet(file.path);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Open in File Explorer</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{file.reason}</p>

                        {/* Citations & Evidence Quotes */}
                        {file.evidence && file.evidence.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                              Verified Code Evidence:
                            </span>
                            {file.evidence.map((ev: EvidenceItem, evIdx: number) => (
                              <div
                                key={evIdx}
                                className="bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                              >
                                <div className="flex items-start space-x-2 overflow-x-auto">
                                  <span className="text-slate-500 whitespace-nowrap">
                                    L{ev.startLine}–L{ev.endLine}:
                                  </span>
                                  <code className="text-slate-200">{ev.quote}</code>
                                </div>
                                {ev.permalink && (
                                  <a
                                    href={ev.permalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 shrink-0 text-xs"
                                  >
                                    <span>View Permalink</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mode 2: Interactive File Explorer Tree & Snippet Viewer */}
                {whereToLookView === 'explorer' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {/* Left Pane: Repository Tree Navigator */}
                    <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                          Repository Tree
                        </span>
                        <button
                          onClick={() => fetchTree()}
                          disabled={treeLoading}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer font-mono"
                        >
                          <RefreshCw className={`h-3 w-3 ${treeLoading ? 'animate-spin' : ''}`} />
                          <span>Refresh</span>
                        </button>
                      </div>

                      {/* Tree Search Filter */}
                      <div className="relative">
                        <input
                          type="text"
                          value={treeSearch}
                          onChange={(e) => setTreeSearch(e.target.value)}
                          placeholder="Filter file paths..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 font-mono"
                        />
                      </div>

                      {/* Tree List Container */}
                      <div className="max-h-[560px] overflow-y-auto space-y-0.5 border border-slate-950 rounded p-1 bg-slate-950/60 font-mono">
                        {treeLoading ? (
                          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Loading tree...</span>
                          </div>
                        ) : (
                          (() => {
                            const renderTree = (nodes: TreeNode[], depth = 0): React.ReactNode => {
                              return nodes.map((node) => {
                                if (node.isFolder) {
                                  const isExpanded = Boolean(expandedFolders[node.path]);
                                  return (
                                    <div key={node.path} className="select-none">
                                      <div
                                        onClick={() => toggleFolder(node.path)}
                                        className="flex items-center space-x-1.5 py-1 px-1.5 rounded hover:bg-slate-800/80 text-slate-300 cursor-pointer text-xs font-mono transition"
                                        style={{ paddingLeft: `${depth * 12 + 6}px` }}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
                                        )}
                                        {isExpanded ? (
                                          <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                        ) : (
                                          <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                        )}
                                        <span className="truncate">{node.name}</span>
                                      </div>
                                      {isExpanded && node.children && (
                                        <div>{renderTree(node.children, depth + 1)}</div>
                                      )}
                                    </div>
                                  );
                                }

                                const candidate = data.relevantFiles.find(
                                  (f: RelevantFile) => f.path === node.path
                                );
                                const isSelected = selectedFilePath === node.path;

                                return (
                                  <div
                                    key={node.path}
                                    onClick={() => fetchSnippet(node.path)}
                                    className={`flex items-center justify-between py-1 px-1.5 rounded cursor-pointer text-xs font-mono transition select-none ${
                                      isSelected
                                        ? 'bg-blue-950 text-blue-200 border border-blue-800 font-medium'
                                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                                    }`}
                                    style={{ paddingLeft: `${depth * 12 + 18}px` }}
                                  >
                                    <div className="flex items-center space-x-1.5 min-w-0">
                                      <FileCode2
                                        className={`h-3.5 w-3.5 shrink-0 ${
                                          candidate ? 'text-emerald-400' : 'text-slate-500'
                                        }`}
                                      />
                                      <span className="truncate">{node.name}</span>
                                    </div>

                                    {candidate && (
                                      <span
                                        className={`text-[9px] px-1 py-0.2 rounded uppercase font-semibold shrink-0 ml-1 ${
                                          candidate.confidence === 'high'
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                                        }`}
                                      >
                                        {candidate.confidence}
                                      </span>
                                    )}
                                  </div>
                                );
                              });
                            };
                            return renderTree(treeHierarchy);
                          })()
                        )}
                      </div>

                      {/* Candidate Quick Jumps */}
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                          Candidate Shortcuts:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {data.relevantFiles.map((f: RelevantFile, i: number) => (
                            <button
                              key={i}
                              onClick={() => fetchSnippet(f.path)}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                                selectedFilePath === f.path
                                  ? 'bg-blue-900/60 text-blue-200 border-blue-700'
                                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                              }`}
                            >
                              {f.path.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Pane: Code Snippet Viewer */}
                    <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                      {/* Snippet Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center space-x-2">
                          <Code className="h-4 w-4 text-blue-400 shrink-0" />
                          <span className="font-mono text-xs font-semibold text-slate-200">
                            {selectedFilePath}
                          </span>
                          {(() => {
                            const candidate = data.relevantFiles.find(
                              (f: RelevantFile) => f.path === selectedFilePath
                            );
                            if (!candidate) return null;
                            return (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                                  candidate.confidence === 'high'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                                }`}
                              >
                                {candidate.confidence} Confidence Candidate
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex items-center space-x-2 text-xs font-mono">
                          {selectedFileSnippet && (
                            <span className="text-slate-500">{selectedFileSnippet.lines} lines</span>
                          )}
                          {selectedFileSnippet && (
                            <button
                              onClick={() => copySnippetToClipboard(selectedFileSnippet.content)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1 cursor-pointer transition text-[11px]"
                            >
                              {copiedSnippet ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                          <a
                            href={`https://github.com/${data.repository.owner}/${data.repository.name}/blob/${data.repository.commitSha}/${selectedFilePath}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 flex items-center space-x-1 text-[11px] transition"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {/* Candidate Insight Box if selected file is candidate */}
                      {(() => {
                        const candidate = data.relevantFiles.find(
                          (f: RelevantFile) => f.path === selectedFilePath
                        );
                        if (!candidate) return null;
                        return (
                          <div className="bg-slate-950 border border-blue-900/60 rounded p-3 text-xs space-y-1.5">
                            <span className="font-mono text-blue-300 font-semibold block">
                              ANALYSIS RATIONALE:
                            </span>
                            <p className="text-slate-300 leading-relaxed">{candidate.reason}</p>
                            {candidate.evidence && candidate.evidence.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-mono">
                                <span className="text-slate-500">Cited Evidence Lines:</span>
                                {candidate.evidence.map((ev: EvidenceItem, i: number) => (
                                  <span
                                    key={i}
                                    className="bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800"
                                  >
                                    L{ev.startLine}–L{ev.endLine}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Code Snippet Box */}
                      {snippetLoading ? (
                        <div className="p-16 text-center text-xs font-mono text-slate-500 flex items-center justify-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                          <span>Fetching file content snippet...</span>
                        </div>
                      ) : selectedFileSnippet ? (
                        <div className="bg-slate-950 border border-slate-800 rounded overflow-hidden">
                          <div className="max-h-[500px] overflow-auto p-2 font-mono text-xs">
                            {selectedFileSnippet.content.split('\n').map((line: string, idx: number) => {
                              const lineNum = idx + 1;
                              const candidate = data.relevantFiles.find(
                                (f: RelevantFile) => f.path === selectedFilePath
                              );
                              const isCited = candidate?.evidence?.some(
                                (ev: EvidenceItem) =>
                                  lineNum >= ev.startLine && lineNum <= ev.endLine
                              );
                              return (
                                <div
                                  key={lineNum}
                                  className={`flex items-start py-0.5 transition ${
                                    isCited
                                      ? 'bg-blue-950/70 text-blue-100 font-medium border-l-2 border-blue-400 pl-1'
                                      : 'text-slate-300 hover:bg-slate-900/60'
                                  }`}
                                >
                                  <span className="w-10 text-right pr-3 select-none text-slate-600 shrink-0 text-[11px]">
                                    {lineNum}
                                  </span>
                                  <span className="whitespace-pre overflow-x-auto flex-1 font-mono">
                                    {line || ' '}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {selectedFileSnippet.truncated && (
                            <div className="p-2 border-t border-slate-800 bg-slate-900/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                              <span>Displaying first 500 lines of file.</span>
                              <a
                                href={`https://github.com/${data.repository.owner}/${data.repository.name}/blob/${data.repository.commitSha}/${selectedFilePath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                              >
                                View complete file on GitHub
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-16 text-center text-xs font-mono text-slate-500">
                          Select a file in the repository tree to inspect its contents and evidence.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Code Flow */}
            {activeTab === 'flow' && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Observed Code Execution Pipeline
                </div>
                <div className="space-y-3">
                  {data.codeFlow.map((step: CodeFlowStep, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-3 p-3 bg-slate-950 rounded border border-slate-800"
                    >
                      <div className="h-6 w-6 rounded bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-medium text-slate-200">{step.step}</div>
                        {step.path && (
                          <div className="text-xs font-mono text-slate-400 flex items-center space-x-2">
                            <span>Path: {step.path}</span>
                            {step.startLine !== null && (
                              <span>(Lines {step.startLine}–{step.endLine})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Investigation Plan & Testing Checklist */}
            {activeTab === 'plan' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Investigation Plan */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Recommended Investigation Plan
                  </div>
                  <ul className="space-y-2.5">
                    {data.investigationPlan.map((step: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                        <span className="text-slate-500 font-mono font-bold mt-0.5">{idx + 1}.</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Testing Checklist */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Testing Checklist & Regressions
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-mono text-slate-400 block mb-1">TESTS TO INSPECT:</span>
                      <ul className="list-disc list-inside text-slate-300 space-y-1">
                        {data.testingChecklist.existingTestsToInspect.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-mono text-slate-400 block mb-1">EDGE CASES TO COVER:</span>
                      <ul className="list-disc list-inside text-slate-300 space-y-1">
                        {data.testingChecklist.edgeCases.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-mono text-slate-400 block mb-1">SUGGESTED COMMANDS:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {data.testingChecklist.commandsToTry.map((c: string, i: number) => (
                          <span
                            key={i}
                            className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-300 font-mono"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Draft PR Kit */}
            {activeTab === 'prkit' && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Draft PR Kit (Ready for your edits)
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded font-mono font-semibold">
                    {data.prKit.disclaimer}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-mono block mb-1">SUGGESTED BRANCH NAME:</label>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 font-mono">
                      {data.prKit.branchName}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-mono block mb-1">SUGGESTED COMMIT MESSAGE:</label>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 font-mono">
                      {data.prKit.commitMessage}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-mono">PR DESCRIPTION SKELETON:</label>
                      <button
                        onClick={() => copyToClipboard(data.prKit.prDescriptionDraft)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedPr ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Template</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      rows={6}
                      value={data.prKit.prDescriptionDraft}
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded text-slate-300 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  {/* Contribution Checklist Section */}
                  <div className="border-t border-slate-800 pt-4 mt-2 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <ListChecks className="h-4 w-4 text-blue-400" />
                        <span className="font-mono text-slate-200 font-semibold uppercase tracking-wider text-xs">
                          Contribution Checklist (Pre-Flight Verification)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <span className="text-slate-400 font-mono text-xs">
                          {completedStepsCount} of {checklistItems.length} completed
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                            isPrReady
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isPrReady ? 'PR Ready for Submission' : 'Work In Progress'}
                        </span>
                        <button
                          onClick={handleSelectAllSteps}
                          className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                        >
                          Check All
                        </button>
                        <button
                          onClick={handleResetChecklist}
                          className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{
                          width: `${checklistItems.length ? (completedStepsCount / checklistItems.length) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    {/* Interactive Checklist Items */}
                    <div className="space-y-2 pt-1">
                      {checklistItems.map((item) => {
                        const isChecked = Boolean(checkedSteps[item.id]);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleChecklistStep(item.id)}
                            className={`p-2.5 rounded border transition cursor-pointer flex items-start space-x-3 select-none ${
                              isChecked
                                ? 'bg-slate-950/70 border-emerald-900/60 text-slate-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0 text-slate-400">
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div
                                className={`text-xs font-mono font-medium ${
                                  isChecked ? 'line-through text-slate-400' : 'text-slate-200'
                                }`}
                              >
                                {item.title}
                              </div>
                              <p className="text-xs text-slate-400 font-sans leading-relaxed truncate">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Similar Issues & PRs */}
            {activeTab === 'similar' && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                      <GitPullRequest className="h-4 w-4 text-indigo-400" />
                      <span>Similar Issues & Pull Requests in Repository</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Context from how other contributors solved or discussed adjacent problems in{' '}
                      <span className="font-mono text-slate-300">
                        {data.repository.owner}/{data.repository.name}
                      </span>
                    </p>
                  </div>

                  {/* Filter Buttons */}
                  <div className="flex items-center space-x-1.5 text-xs font-mono">
                    {(['all', 'issues', 'prs', 'closed'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setSimilarFilter(f)}
                        className={`px-2.5 py-1 rounded transition capitalize cursor-pointer ${
                          similarFilter === f
                            ? 'bg-slate-100 text-slate-950 font-semibold'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {f === 'prs' ? 'PRs Only' : f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar & Refresh */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={similarQuery}
                      onChange={(e) => setSimilarQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSimilarIssues()}
                      placeholder="Search related keywords (e.g. prototype, query parser, urlencoded)..."
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
                    />
                  </div>
                  <button
                    onClick={() => fetchSimilarIssues()}
                    disabled={similarLoading}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {similarLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Search GitHub</span>
                  </button>
                </div>

                {/* Similar Issues List */}
                {similarLoading ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-400 flex items-center justify-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Searching GitHub issues and PRs...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {similarIssues
                      .filter((item) => {
                        if (similarFilter === 'issues') return !item.isPr;
                        if (similarFilter === 'prs') return item.isPr;
                        if (similarFilter === 'closed') return item.state === 'closed';
                        return true;
                      })
                      .map((item) => (
                        <div
                          key={item.number}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 transition rounded-lg p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2.5">
                              {item.isPr ? (
                                <GitPullRequest className="h-4 w-4 text-purple-400 shrink-0" />
                              ) : (
                                <CircleDot className="h-4 w-4 text-emerald-400 shrink-0" />
                              )}
                              <span className="font-mono text-xs font-bold text-slate-400">
                                #{item.number}
                              </span>
                              <a
                                href={item.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-slate-100 hover:text-blue-400 transition flex items-center space-x-1"
                              >
                                <span>{item.title}</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                            </div>

                            <div className="flex items-center space-x-2 text-xs font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  item.state === 'closed'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {item.state}
                              </span>
                              {item.comments_count > 0 && (
                                <span className="text-slate-400 flex items-center space-x-1 text-[11px]">
                                  <MessageCircle className="h-3 w-3" />
                                  <span>{item.comments_count}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Body snippet / Resolution notes */}
                          {item.body_snippet && (
                            <p className="text-xs text-slate-300 font-sans leading-relaxed line-clamp-2">
                              {item.body_snippet}
                            </p>
                          )}

                          {/* Labels and Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900 text-xs">
                            <div className="flex flex-wrap gap-1.5">
                              {item.labels.map((label: { name: string; color: string }, lIdx: number) => (
                                <span
                                  key={lIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono"
                                >
                                  {label.name}
                                </span>
                              ))}
                            </div>

                            <button
                              onClick={() => {
                                setChatRole('code_navigator');
                                setChatInput(
                                  `How does ${item.isPr ? 'PR' : 'Issue'} #${item.number} ("${item.title}") relate to our current problem, and what can we learn from its approach?`
                                );
                                setActiveTab('copilot');
                              }}
                              className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center space-x-1 cursor-pointer"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Ask Copilot About This</span>
                            </button>
                          </div>
                        </div>
                      ))}

                    {similarIssues.length === 0 && (
                      <div className="p-8 text-center text-xs font-mono text-slate-400">
                        No similar issues found matching the query. Try searching with different keywords above.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Copilot Multi-Turn Chat Thread */}
            {activeTab === 'copilot' && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      RepoLens Copilot — Multi-Turn Investigation Chat
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ask questions grounded in the repository file tree and verified analysis.
                    </p>
                  </div>

                  {/* Role Selector */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-mono">Copilot Persona:</span>
                    <select
                      value={chatRole}
                      onChange={(e) => setChatRole(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
                    >
                      <option value="code_navigator">Code Navigator (Architecture & Paths)</option>
                      <option value="test_engineer">Test Engineer (Repro & Edge Cases)</option>
                      <option value="pr_reviewer">PR Specialist (Conventions & Commits)</option>
                    </select>
                  </div>
                </div>

                {/* Conversation Thread (Scrollable) */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-96 overflow-y-auto space-y-3.5">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start space-x-3 text-xs ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.role === 'model' && (
                        <div className="h-6 w-6 rounded bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center shrink-0">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-2xl rounded-lg p-3 whitespace-pre-wrap leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-slate-800 text-slate-100 border border-slate-700 font-medium'
                            : 'bg-slate-900 text-slate-200 border border-slate-800 font-sans'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.role === 'user' && (
                        <div className="h-6 w-6 rounded bg-slate-700 text-slate-200 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center space-x-2 text-xs text-slate-400 py-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Copilot is formulating a grounded response...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-500 font-mono self-center">Suggested:</span>
                  {[
                    'Where should I write the reproduction test?',
                    'How does the query middleware interact with the router?',
                    'Draft a minimal reproduction script for this bug',
                  ].map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(chip)}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 px-2.5 py-1 rounded text-slate-300 transition cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Ask a question about the code flow, test suites, or files to inspect..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 font-medium text-xs rounded transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 6: Beginner Mode Glossary */}
            {activeTab === 'glossary' && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Beginner Glossary of Terms Used
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.glossary.map((g: { term: string; definition: string }, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800 text-xs">
                      <div className="font-mono font-semibold text-slate-200 mb-1">{g.term}</div>
                      <p className="text-slate-400 leading-relaxed">{g.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Honesty Panel — ALWAYS VISIBLE per spec */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <span>Honesty & Evidence Verification Panel</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Verified Facts */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <span className="font-mono font-semibold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>VERIFIED FACTS</span>
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {data.honesty.verifiedFacts.map((fact: string, i: number) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                </div>

                {/* Hypotheses */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <span className="font-mono font-semibold text-amber-400 flex items-center space-x-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>HYPOTHESES (UNPROVEN)</span>
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {data.honesty.hypotheses.map((hyp: string, i: number) => (
                      <li key={i}>{hyp}</li>
                    ))}
                  </ul>
                </div>

                {/* Missing Context */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <span className="font-mono font-semibold text-slate-400 flex items-center space-x-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>MISSING CONTEXT & LIMITS</span>
                  </span>
                  <ul className="space-y-1 text-slate-400 list-disc list-inside">
                    {data.honesty.missingContext.concat(data.honesty.limitations).map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Collapsible Diagnostics Box */}
            <div className="border border-slate-800 rounded bg-slate-900/60 overflow-hidden text-xs">
              <button
                onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition font-mono cursor-pointer"
              >
                <span>How this analysis was constructed (Diagnostics)</span>
                {diagnosticsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {diagnosticsOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800 text-xs font-mono grid grid-cols-2 md:grid-cols-5 gap-3 text-slate-400">
                  <div>Files Fetched: <span className="text-slate-200">{data.diagnostics.filesFetched}</span></div>
                  <div>Files Cited: <span className="text-slate-200">{data.diagnostics.filesCited}</span></div>
                  <div>Citations Dropped: <span className="text-slate-200">{data.diagnostics.citationsDropped}</span></div>
                  <div>Tree Truncated: <span className="text-slate-200">{data.diagnostics.truncated ? 'Yes' : 'No'}</span></div>
                  <div>Pipeline Latency: <span className="text-slate-200">{data.diagnostics.timingMs}ms</span></div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-4 text-xs font-mono text-slate-500 text-center">
        RepoLens AI • Built for open-source contributors & Hacktoberfest • Grounded evidence over fluency
      </footer>
    </div>
  );
}
