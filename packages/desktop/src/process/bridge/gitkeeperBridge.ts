/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ipcBridge } from '@/common';
import type {
  GitKeeperAdvisoryRequest,
  GitKeeperAdvisoryResponse,
  GitKeeperExecuteApprovedPlanRequest,
  GitKeeperExecuteApprovedPlanResponse,
  GitKeeperIgnoreFilesRequest,
  GitKeeperIgnoreFilesResponse,
  GitKeeperPopupState,
  GitKeeperPopupStateRequest,
} from '@/common/adapter/ipcBridge';

const execFileAsync = promisify(execFile);

const GITKEEPER_CLI = '/Users/richard/coding-projects/github-repos/gitkeeper/dist/cli.js';
const NODE_BIN = '/Users/richard/Coding Tools/bin/node';
const GIT_BIN = '/Users/richard/Coding Tools/bin/git';
const CODEX_BIN_CANDIDATES = [
  process.env.GITKEEPER_CODEX_COMMAND,
  '/opt/homebrew/bin/codex',
  '/usr/local/bin/codex',
  '/Users/richard/Coding Tools/bin/codex',
].filter((candidate): candidate is string => Boolean(candidate));
const EXEC_TIMEOUT_MS = 15_000;
const GITKEEPER_OPERATION_TIMEOUT_MS = 120_000;
const PENDING_SYNC_TIMEOUT_MS = 30_000;
const advisorySessions = new Map<string, string>();

function normalizeMachineName(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value.includes('laptop') || value.includes('macbook')) return 'laptop';
  if (value.includes('server')) return 'server';
  if (value.includes('study')) return 'study';
  return value || 'study';
}

function parseRepositoryId(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;

  return null;
}

async function resolveRepositoryId(request: GitKeeperPopupStateRequest): Promise<string> {
  if (request.repositoryId?.trim()) {
    return request.repositoryId.trim();
  }

  const { stdout } = await execFileAsync(GIT_BIN, ['-C', request.workspace, 'config', '--get', 'remote.origin.url'], {
    timeout: EXEC_TIMEOUT_MS,
  });
  const repositoryId = parseRepositoryId(stdout);
  if (!repositoryId) {
    throw new Error('GitKeeper could not resolve a GitHub repository id for this workspace.');
  }
  return repositoryId;
}

async function buildPopupState(request: GitKeeperPopupStateRequest): Promise<GitKeeperPopupState> {
  if (!existsSync(GITKEEPER_CLI)) {
    throw new Error('GitKeeper CLI is not built at the expected local path.');
  }

  await retryPendingPeerSyncs();

  const repositoryId = await resolveRepositoryId(request);
  const sourceMachine = normalizeMachineName(process.env.GITKEEPER_MACHINE || os.hostname());
  const args = [
    GITKEEPER_CLI,
    'gui',
    'popup-state',
    '--host',
    request.host ?? 'kodo_aoin_workbench',
    '--repository-id',
    repositoryId,
    '--repo-path',
    request.workspace,
    '--source-machine',
    sourceMachine,
  ];

  if (request.threadId?.trim()) {
    args.push('--thread-id', request.threadId.trim());
  }

  for (const machine of request.offlineMachines ?? []) {
    if (machine.trim()) args.push('--offline-machine', machine.trim());
  }

  const { stdout } = await execFileAsync(NODE_BIN, args, { timeout: EXEC_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout) as GitKeeperPopupState;
}

async function retryPendingPeerSyncs(): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      NODE_BIN,
      [GITKEEPER_CLI, 'repo', 'pending-sync', 'retry-all', '--execute', '--json'],
      { timeout: PENDING_SYNC_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );
    const results = JSON.parse(stdout) as Array<{ status?: string }>;
    if (results.length > 0) {
      console.info('[GitKeeper] pending peer sync retry completed', {
        total: results.length,
        completed: results.filter((result) => result.status === 'completed').length,
      });
    }
  } catch (error) {
    console.warn('[GitKeeper] pending peer sync retry deferred', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function advisorySessionId(request: GitKeeperAdvisoryRequest): string {
  return `${request.threadId?.trim() || 'popup'}:${request.workspace}`;
}

function resolveCodexCommand(): string | null {
  return CODEX_BIN_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

type GitKeeperAdvisorySession = {
  sessionId: string;
  provider?: string;
  recommendationCards?: Array<{
    repositoryId?: string;
    summary?: string;
    recommendation?: string;
    action?: string;
    files?: string[];
    commitMessage?: string;
    blockers?: string[];
  }>;
  messages?: Array<{ role?: string; content?: string }>;
  diagnostics?: string[];
};

function mapAdvisorySessionToResponse(session: GitKeeperAdvisorySession): GitKeeperAdvisoryResponse {
  const cards = (session.recommendationCards ?? []).map((card) => ({
    repositoryId: card.repositoryId ?? 'repository',
    summary: card.summary ?? 'GitKeeper advisory recommendation.',
    recommendation: card.recommendation ?? 'Review before protected execution.',
    approvedFiles: card.action === 'gitignore_files' || card.action === 'leave_uncommitted' ? [] : card.files ?? [],
    commitMessage: card.commitMessage ?? '',
    risks: [
      ...(card.blockers ?? []),
      ...(session.diagnostics ?? []),
    ],
  }));
  const answer = [...(session.messages ?? [])]
    .reverse()
    .find((message) => message.role === 'assistant')?.content
    ?? (cards.length > 0
      ? 'GitKeeper produced advisory recommendation cards. Type ok or press Approve plan to validate and execute them.'
      : 'GitKeeper found no advisory cards for this workspace.');
  return {
    temporaryThreadId: session.sessionId,
    provider: session.provider === 'codex_cli' ? 'codex' : session.provider ?? 'deterministic',
    cards,
    answer,
  };
}

async function buildAdvisory(request: GitKeeperAdvisoryRequest): Promise<GitKeeperAdvisoryResponse> {
  const sessionId = advisorySessionId(request);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gitkeeper-advisory-'));
  const popupStateFile = path.join(tempDir, 'popup-state.json');
  try {
    const existingSessionId = advisorySessions.get(sessionId);
    const question = request.question?.trim();
    const codexCommand = resolveCodexCommand();
    if (existingSessionId && question) {
      const args = [
        GITKEEPER_CLI,
        'advisory',
        'message',
        '--session-id',
        existingSessionId,
        '--message',
        question,
        '--actor',
        'aion',
      ];
      if (codexCommand) {
        args.push('--codex-command', codexCommand);
      }
      const { stdout } = await execFileAsync(
        NODE_BIN,
        args,
        { timeout: GITKEEPER_OPERATION_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
      );
      const result = JSON.parse(stdout) as { session: GitKeeperAdvisorySession };
      return mapAdvisorySessionToResponse(result.session);
    }

    writeFileSync(popupStateFile, JSON.stringify(request.state, null, 2));
    const { stdout } = await execFileAsync(
      NODE_BIN,
      [
        GITKEEPER_CLI,
        'advisory',
        'start',
        '--popup-state-file',
        popupStateFile,
        '--provider',
        'codex_cli',
        ...(codexCommand ? ['--codex-command', codexCommand] : []),
      ],
      { timeout: GITKEEPER_OPERATION_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );
    const result = JSON.parse(stdout) as { session: GitKeeperAdvisorySession };
    advisorySessions.set(sessionId, result.session.sessionId);
    return mapAdvisorySessionToResponse(result.session);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function approvedPreflightFor(request: GitKeeperExecuteApprovedPlanRequest): Record<string, unknown> {
  const preflight = request.state.source?.preflight;
  if (!preflight || typeof preflight !== 'object') {
    throw new Error('GitKeeper popup state is missing source preflight data.');
  }

  const cardsByRepo = new Map(request.cards.map((card) => [card.repositoryId, card]));
  const rawPlans = Array.isArray((preflight as { repoPlans?: unknown }).repoPlans)
    ? (preflight as { repoPlans: Array<Record<string, unknown>> }).repoPlans
    : [];
  const repoPlans = rawPlans.map((plan) => {
    const repositoryId = typeof plan.repositoryId === 'string' ? plan.repositoryId : '';
    const card = cardsByRepo.get(repositoryId);
    if (!card) return plan;
    const approvedFiles = Array.from(new Set(card.approvedFiles.filter(Boolean))).sort();
    return {
      ...plan,
      status: plan.status === 'blocked' && approvedFiles.length > 0 ? 'ready' : plan.status,
      approvedFiles,
      leftBehindFiles: Array.isArray(plan.leftBehindFiles)
        ? plan.leftBehindFiles.filter((file): file is string => typeof file === 'string' && !approvedFiles.includes(file))
        : [],
      commitMessage: card.commitMessage || plan.commitMessage,
      blockers: Array.isArray(plan.blockers)
        ? plan.blockers
          .map(String)
          .filter((blocker) => !['approved_files_required', 'dirty_files_not_approved'].includes(blocker))
        : [],
      warnings: Array.isArray(plan.warnings)
        ? plan.warnings.map(String).filter((warning) => warning !== 'left_behind_dirty_files_require_review')
        : [],
    };
  });
  const groupBlockers = repoPlans.flatMap((plan) => Array.isArray(plan.blockers) ? plan.blockers.map(String) : []);
  const requiresAdvisory = repoPlans.some((plan) => plan.status === 'needs_codex_advisory');
  const status = groupBlockers.length > 0 ? 'blocked' : requiresAdvisory ? 'needs_codex_advisory' : 'ready';
  return {
    ...preflight,
    status,
    canProceedAutomatically: status === 'ready',
    requiresCodexAdvisory: requiresAdvisory,
    blockers: groupBlockers,
    warnings: Array.isArray((preflight as { warnings?: unknown }).warnings)
      ? (preflight as { warnings: unknown[] }).warnings
        .map(String)
        .filter((warning) => warning !== 'codex_advisory_required_for_some_repos')
      : [],
    repoPlans,
  };
}

function formatGroupExecutionResult(result: Record<string, unknown>): GitKeeperExecuteApprovedPlanResponse {
  const status = typeof result.status === 'string' ? result.status : 'failed';
  return {
    status,
    results: [result],
  };
}

async function archiveAdvisoryFor(request: GitKeeperExecuteApprovedPlanRequest): Promise<void> {
  if (!request.threadId?.trim()) return;
  const key = `${request.threadId.trim()}:${request.workspace}`;
  const sessionId = advisorySessions.get(key);
  if (!sessionId) return;
  try {
    await execFileAsync(
      NODE_BIN,
      [GITKEEPER_CLI, 'advisory', 'archive', '--session-id', sessionId],
      { timeout: EXEC_TIMEOUT_MS, maxBuffer: 1024 * 1024 }
    );
  } catch (error) {
    console.warn('[GitKeeper] advisory archive deferred', {
      sessionId,
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    advisorySessions.delete(key);
  }
}

async function executeApprovedPlan(
  request: GitKeeperExecuteApprovedPlanRequest
): Promise<GitKeeperExecuteApprovedPlanResponse> {
  if (!existsSync(GITKEEPER_CLI)) {
    throw new Error('GitKeeper CLI is not built at the expected local path.');
  }

  const sourceMachine = normalizeMachineName(request.sourceMachine);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gitkeeper-execute-group-'));
  const preflightFile = path.join(tempDir, 'preflight.json');

  writeFileSync(preflightFile, JSON.stringify(approvedPreflightFor(request), null, 2));
  const { stdout } = await execFileAsync(
    NODE_BIN,
    [
      GITKEEPER_CLI,
      'thread',
      'execute-group',
      '--preflight-file',
      preflightFile,
      '--execute',
      '--grant-confirmation',
      '--actor',
      'aion',
      '--caller',
      'aion-gitkeeper-popup',
      '--idempotency-key',
      request.threadId?.trim() ? `aion-popup:${request.threadId.trim()}` : `aion-popup:${sourceMachine}:${Date.now()}`,
    ],
    { timeout: GITKEEPER_OPERATION_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }
  ).finally(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });
  const result = JSON.parse(stdout) as Record<string, unknown>;

  await archiveAdvisoryFor(request);

  return formatGroupExecutionResult(result);
}

function ignorePatternFor(relativePath: string): string {
  const clean = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (clean.startsWith('../') || clean.includes('/../')) {
    throw new Error(`Refusing to ignore unsafe path: ${relativePath}`);
  }
  if (clean.startsWith('dist/')) return 'dist/';
  if (clean.startsWith('build/')) return 'build/';
  return clean;
}

async function ignoreFiles(request: GitKeeperIgnoreFilesRequest): Promise<GitKeeperIgnoreFilesResponse> {
  const patterns = Array.from(new Set(request.paths.filter(Boolean).map(ignorePatternFor)));
  if (patterns.length === 0) {
    return { status: 'unchanged', patterns: [] };
  }

  const gitignorePath = path.join(request.workspace, '.gitignore');
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const missing = patterns.filter((pattern) => !existingLines.has(pattern));

  if (missing.length === 0) {
    return { status: 'unchanged', patterns };
  }

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '');
  }
  const needsLeadingBreak = existing.length > 0 && !existing.endsWith('\n');
  appendFileSync(gitignorePath, `${needsLeadingBreak ? '\n' : ''}\n# GitKeeper generated artifact ignores\n${missing.join('\n')}\n`);
  return { status: 'updated', patterns: missing };
}

export function initGitKeeperBridge(): void {
  ipcBridge.gitkeeper.getPopupState.provider(async (request) => {
    try {
      return { success: true, data: await buildPopupState(request) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  ipcBridge.gitkeeper.getAdvisory.provider(async (request) => {
    try {
      return { success: true, data: await buildAdvisory(request) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  ipcBridge.gitkeeper.executeApprovedPlan.provider(async (request) => {
    try {
      return { success: true, data: await executeApprovedPlan(request) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });

  ipcBridge.gitkeeper.ignoreFiles.provider(async (request) => {
    try {
      return { success: true, data: await ignoreFiles(request) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });
}
