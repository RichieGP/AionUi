/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { ipcBridge } from '@/common';
import type { GitKeeperPopupState, GitKeeperPopupStateRequest } from '@/common/adapter/ipcBridge';

const execFileAsync = promisify(execFile);

const GITKEEPER_CLI = '/Users/richard/coding-projects/github-repos/gitkeeper/dist/cli.js';
const NODE_BIN = '/Users/richard/Coding Tools/bin/node';
const GIT_BIN = '/Users/richard/Coding Tools/bin/git';
const EXEC_TIMEOUT_MS = 15_000;

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

export function initGitKeeperBridge(): void {
  ipcBridge.gitkeeper.getPopupState.provider(async (request) => {
    try {
      return { success: true, data: await buildPopupState(request) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, msg };
    }
  });
}
