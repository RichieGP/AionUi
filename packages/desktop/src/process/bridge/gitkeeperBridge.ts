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
const CODEX_BIN = '/Users/richard/.local/bin/codex';
const CODEX_HOME = '/Users/richard/.codex-aion-ollama-qwen3-30b';
const EXEC_TIMEOUT_MS = 15_000;
const CODEX_TIMEOUT_MS = 30_000;
const advisorySessions = new Map<string, string[]>();

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

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Codex advisory did not return JSON.');
  return raw.slice(start, end + 1);
}

function advisorySessionId(request: GitKeeperAdvisoryRequest): string {
  return `${request.threadId?.trim() || 'popup'}:${request.workspace}`;
}

function advisoryPrompt(request: GitKeeperAdvisoryRequest, history: string[]): string {
  return [
    'You are GitKeeper v2 advisory mode inside the Aion popup.',
    'Read-only task: summarize dirty repo state and recommend an explicit per-repo commit/sync plan.',
    'Do not edit files, run mutation commands, commit, push, reset, stash, or discard anything.',
    'Return strict JSON only with this shape:',
    '{"temporaryThreadId":"string","cards":[{"repositoryId":"string","summary":"string","recommendation":"string","approvedFiles":["path"],"commitMessage":"string","risks":["string"]}],"answer":"string"}',
    'Use concise, practical recommendations. If the user asks a follow-up question, answer it in the same JSON answer field and keep cards current.',
    `Workspace: ${request.workspace}`,
    `Thread id: ${request.threadId ?? 'unknown'}`,
    `Recent advisory chat: ${history.slice(-6).join('\n') || 'none'}`,
    `User question: ${request.question?.trim() || 'Initial advisory summary and recommendation.'}`,
    `GitKeeper popup state JSON: ${JSON.stringify(request.state)}`,
  ].join('\n\n');
}

async function buildAdvisory(request: GitKeeperAdvisoryRequest): Promise<GitKeeperAdvisoryResponse> {
  const sessionId = advisorySessionId(request);
  const history = advisorySessions.get(sessionId) ?? [];
  if (request.question?.trim()) {
    history.push(`User: ${request.question.trim()}`);
  }

  if (!existsSync(CODEX_BIN)) {
    console.warn('[GitKeeper] Codex advisory fallback: Codex CLI is not available');
    const response = buildDeterministicAdvisory(request, 'Codex CLI is not available.');
    history.push(`GitKeeper: ${response.answer}`);
    advisorySessions.set(sessionId, history);
    return response;
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gitkeeper-advisory-'));
  const outputFile = path.join(tempDir, 'last-message.json');

  try {
    try {
      console.info('[GitKeeper] Codex advisory start', {
        sessionId,
        workspace: request.workspace,
        question: request.question?.trim() || 'initial',
      });
      await execFileAsync(
        CODEX_BIN,
        ['exec', '--cd', request.workspace, '--sandbox', 'read-only', '--output-last-message', outputFile, advisoryPrompt(request, history)],
        {
          timeout: CODEX_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            CODEX_HOME,
          },
        }
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[GitKeeper] Codex advisory fallback after exec failure', { sessionId, reason });
      const response = buildDeterministicAdvisory(request, reason);
      history.push(`GitKeeper: ${response.answer}`);
      advisorySessions.set(sessionId, history);
      return response;
    }
    if (!existsSync(outputFile)) {
      console.warn('[GitKeeper] Codex advisory fallback: output file missing', { sessionId, outputFile });
      const response = buildDeterministicAdvisory(request, 'Codex exited without writing an advisory message.');
      history.push(`GitKeeper: ${response.answer}`);
      advisorySessions.set(sessionId, history);
      return response;
    }
    const response = JSON.parse(extractJsonObject(readFileSync(outputFile, 'utf8'))) as GitKeeperAdvisoryResponse;
    response.provider = 'codex';
    console.info('[GitKeeper] Codex advisory succeeded', {
      sessionId,
      cards: response.cards.length,
    });
    history.push(`GitKeeper: ${response.answer}`);
    advisorySessions.set(sessionId, history);
    return response;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildDeterministicAdvisory(request: GitKeeperAdvisoryRequest, reason: string): GitKeeperAdvisoryResponse {
  const question = request.question?.trim();
  return {
    temporaryThreadId: request.threadId ? `gitkeeper-${request.threadId}` : 'gitkeeper-popup',
    provider: 'deterministic',
    cards: request.state.repoCards.map((card) => {
      const files = Array.from(new Set([...card.dirtyFiles, ...card.leftBehindFiles]));
      const repoName = card.repositoryId.split('/').at(-1) ?? card.repositoryId;
      const hardBlockers = card.blockers.filter((blocker) => !['approved_files_required', 'dirty_files_not_approved'].includes(blocker));
      const groupedSummary = files.length === 0
        ? 'No dirty files detected.'
        : files.length <= 3
        ? `Dirty source files: ${files.join(', ')}.`
        : `${files.length} dirty source files grouped for one protected GitKeeper checkpoint.`;
      const recommendation = hardBlockers.length > 0
        ? `Do not auto-sync yet. Resolve blockers first: ${hardBlockers.join(', ')}.`
        : files.length > 0
        ? 'Commit the source-owned dirt, push it, then fast-forward clean peers. If a peer has unrelated dirt, leave that peer pending and show the reason.'
        : 'Push the source branch if needed and fast-forward available peers.';
      return {
        repositoryId: card.repositoryId,
        summary: groupedSummary,
        recommendation,
        approvedFiles: hardBlockers.length > 0 ? [] : files,
        commitMessage: files.length > 0 ? `Update ${repoName}` : '',
        risks: reason ? [`Codex advisory fallback used: ${reason}`] : [],
      };
    }),
    answer: [
      question ? `Question: ${question}` : 'Initial GitKeeper advisory.',
      reason
        ? `Codex advisory was unavailable, so GitKeeper produced a deterministic recommendation. ${reason}`
        : 'GitKeeper produced a deterministic recommendation.',
      'If the recommendation is acceptable, type ok or press Approve plan, then GitKeeper will execute through the protected operation route.',
    ].join(' '),
  };
}

function operationIdFor(threadId: string | undefined, repositoryId: string): string {
  const prefix = threadId?.trim() || 'aion-popup';
  return `${prefix}-${repositoryId.replaceAll('/', '-')}`;
}

async function executeApprovedPlan(
  request: GitKeeperExecuteApprovedPlanRequest
): Promise<GitKeeperExecuteApprovedPlanResponse> {
  if (!existsSync(GITKEEPER_CLI)) {
    throw new Error('GitKeeper CLI is not built at the expected local path.');
  }

  const results: Array<Record<string, unknown>> = [];
  const sourceMachine = normalizeMachineName(request.sourceMachine);

  for (const card of request.cards) {
    const args = [
      GITKEEPER_CLI,
      'repo',
      'remote-propagate',
      '--operation-id',
      operationIdFor(request.threadId, card.repositoryId),
      '--source-path',
      request.workspace,
      '--source-machine',
      sourceMachine,
      '--repository-id',
      card.repositoryId,
      '--execute',
      '--json',
    ];

    if (card.commitMessage.trim()) {
      args.push('--message', card.commitMessage);
    }

    for (const file of card.approvedFiles) {
      args.push('--approve-path', file);
    }

    // Keep protected Git operations sequential so receipts and peer sync state stay ordered per repo.
    // eslint-disable-next-line no-await-in-loop
    const { stdout } = await execFileAsync(NODE_BIN, args, {
      timeout: CODEX_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
    results.push(JSON.parse(stdout) as Record<string, unknown>);
  }

  if (request.threadId?.trim()) {
    advisorySessions.delete(`${request.threadId.trim()}:${request.workspace}`);
  }

  return { status: 'executed', results };
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
