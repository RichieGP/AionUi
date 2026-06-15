/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from '@arco-design/web-react';
import type { GitKeeperAdvisoryResponse, GitKeeperPopupState } from '@/common/adapter/ipcBridge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const {
  getPopupStateMock,
  getAdvisoryMock,
  executeApprovedPlanMock,
  ignoreFilesMock,
} = vi.hoisted(() => ({
  getPopupStateMock: vi.fn(),
  getAdvisoryMock: vi.fn(),
  executeApprovedPlanMock: vi.fn(),
  ignoreFilesMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    gitkeeper: {
      getPopupState: { invoke: getPopupStateMock },
      getAdvisory: { invoke: getAdvisoryMock },
      executeApprovedPlan: { invoke: executeApprovedPlanMock },
      ignoreFiles: { invoke: ignoreFilesMock },
    },
  },
}));

import GitKeeperPopup from '@/renderer/pages/conversation/Workspace/components/GitKeeperPopup/GitKeeperPopup';

const popupState: GitKeeperPopupState = {
  schemaVersion: 1,
  host: 'kodo_aoin_workbench',
  operationGroupId: 'group-1',
  threadId: 'thread-1',
  generatedAt: '2026-06-15T10:00:00.000Z',
  sourceMachine: 'study',
  machines: [
    { machine: 'study', label: 'study', role: 'source', available: true, icon: 'apple_desktop' },
    { machine: 'server', label: 'server', role: 'peer', available: true, icon: 'apple_desktop' },
    { machine: 'laptop', label: 'laptop', role: 'peer', available: false, icon: 'apple_laptop' },
  ],
  flows: [
    { from: 'study', to: 'server', status: 'planned', summary: 'sync server' },
    { from: 'study', to: 'laptop', status: 'failed', summary: 'laptop offline' },
  ],
  repoCards: [{
    repositoryId: 'RichieGP/example',
    operationId: 'op-1',
    status: 'needs_codex_advisory',
    expandedByDefault: true,
    dirtyFiles: ['dist/app.js'],
    selectedFiles: [],
    leftBehindFiles: ['dist/app.js'],
    dirtClassification: {
      totalFiles: 1,
      displayMode: 'individual',
      summary: '1 generated build file requires review.',
      groups: [{
        id: 'generated',
        kind: 'generated',
        title: 'Generated output',
        summary: 'dist/app.js changed.',
        recommendation: 'Review before committing or ignore it.',
        files: ['dist/app.js'],
        displayMode: 'individual',
        summarizer: 'deterministic',
      }],
    },
    blockers: ['approved_files_required'],
    warnings: [],
    recommendedActions: [],
    peerState: [],
    receiptLinks: [],
  }],
  advisory: {
    required: true,
    showCodexCards: true,
    showChat: true,
    chatPlaceholder: '',
    recommendationCards: [],
  },
  approval: {
    required: true,
    state: 'pending',
    grantRequiredForExecution: true,
  },
  automation: {
    nonInteractive: false,
    canAutoProceed: false,
  },
  progress: [],
  closeBehavior: {
    closeWhenComplete: true,
    deleteTemporaryCodexThread: true,
  },
  source: {
    preflight: {
      status: 'needs_codex_advisory',
      canProceedAutomatically: false,
      requiresCodexAdvisory: true,
      blockers: [],
      warnings: [],
      repoPlans: [{
        repositoryId: 'RichieGP/example',
        operationId: 'op-1',
        status: 'needs_codex_advisory',
        approvedFiles: [],
        leftBehindFiles: ['dist/app.js'],
        blockers: ['approved_files_required'],
        warnings: ['left_behind_dirty_files_require_review'],
      }],
    },
  },
};

const advisoryStart: GitKeeperAdvisoryResponse = {
  temporaryThreadId: 'advisory-thread-1',
  provider: 'codex',
  cards: [{
    repositoryId: 'RichieGP/example',
    summary: 'Codex summary: generated build output changed.',
    recommendation: 'Leave it uncommitted unless this is a release artifact.',
    approvedFiles: ['dist/app.js'],
    commitMessage: 'Update example build output',
    risks: [],
  }],
  answer: 'Codex has reviewed the dirt and recommends caution.',
};

const advisoryFollowUp: GitKeeperAdvisoryResponse = {
  ...advisoryStart,
  answer: 'Codex follow-up: this is generated output, so commit only if intentional.',
};

function renderPopup() {
  return render(
    <ConfigProvider>
      <GitKeeperPopup workspace='/tmp/example' conversationId='thread-1' />
    </ConfigProvider>
  );
}

async function openPopup(container: HTMLElement) {
  const button = container.querySelector('.workspace-toolbar-icon-btn');
  expect(button).toBeTruthy();
  await userEvent.click(button as Element);
  await screen.findByText('Codex summary: generated build output changed.');
}

describe('GitKeeperPopup', () => {
  beforeEach(() => {
    getPopupStateMock.mockResolvedValue({ success: true, data: popupState });
    getAdvisoryMock.mockResolvedValue({ success: true, data: advisoryStart });
    executeApprovedPlanMock.mockResolvedValue({
      success: true,
      data: {
        status: 'succeeded',
        results: [{ operationType: 'thread_operation_group', status: 'succeeded' }],
      },
    });
    ignoreFilesMock.mockResolvedValue({ success: true, data: { status: 'unchanged', patterns: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('submits popup chat questions through the GitKeeper advisory bridge', async () => {
    const user = userEvent.setup();
    getAdvisoryMock
      .mockResolvedValueOnce({ success: true, data: advisoryStart })
      .mockResolvedValueOnce({ success: true, data: advisoryFollowUp });
    const { container } = renderPopup();

    await openPopup(container);
    await user.type(
      screen.getByPlaceholderText('conversation.workspace.gitkeeper.codexChatPlaceholder'),
      'Why is this risky?'
    );
    await user.click(screen.getByText('conversation.workspace.gitkeeper.askCodex'));

    await screen.findByText('Codex follow-up: this is generated output, so commit only if intentional.');
    expect(getAdvisoryMock).toHaveBeenLastCalledWith({
      workspace: '/tmp/example',
      threadId: 'thread-1',
      question: 'Why is this risky?',
      state: popupState,
    });
  });

  it('executes the approved Codex plan through GitKeeper instead of leaving approval inert', async () => {
    const user = userEvent.setup();
    const { container } = renderPopup();

    await openPopup(container);
    await user.click(screen.getByText('conversation.workspace.gitkeeper.approvePlan'));

    await waitFor(() => expect(executeApprovedPlanMock).toHaveBeenCalledTimes(1));
    expect(executeApprovedPlanMock).toHaveBeenCalledWith({
      workspace: '/tmp/example',
      sourceMachine: 'study',
      threadId: 'thread-1',
      state: popupState,
      cards: advisoryStart.cards,
    });
  });
});
