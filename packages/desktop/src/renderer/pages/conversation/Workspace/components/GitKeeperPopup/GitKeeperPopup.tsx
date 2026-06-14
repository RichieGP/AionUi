/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type {
  GitKeeperAdvisoryResponse,
  GitKeeperPopupMachine,
  GitKeeperPopupRepoCard,
  GitKeeperPopupState,
} from '@/common/adapter/ipcBridge';
import { iconColors } from '@/renderer/styles/colors';
import { Alert, Button, Empty, Input, Modal, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Apple, Branch, CheckOne, CloseOne, CodeLaptop, Computer, DatabaseSync, Refresh, Right } from '@icon-park/react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './GitKeeperPopup.module.css';

type GitKeeperPopupProps = {
  workspace: string;
  conversationId: string;
};

type GitKeeperPopupStateWithSource = GitKeeperPopupState & {
  source?: {
    dashboard?: {
      cards?: Array<{
        machine?: string;
        repositoryId?: string;
        state?: string;
        dirtySummary?: {
          dirtyCount?: number;
          dirtyPaths?: string[];
        };
        inspection?: {
          head?: string;
          workingTree?: {
            dirtyPaths?: Array<{ path: string; indexStatus?: string; worktreeStatus?: string }>;
          };
        };
      }>;
    };
  };
};

function machineIcon(machine: GitKeeperPopupMachine): React.ReactNode {
  if (machine.icon === 'apple_laptop') return <CodeLaptop size={18} />;
  if (machine.icon === 'apple_desktop') return <Computer size={18} />;
  return <Apple size={18} />;
}

function statusColor(status: string): 'green' | 'orange' | 'red' | 'blue' | 'gray' {
  if (status === 'ready' || status === 'clean' || status === 'planned' || status === 'ok') return 'green';
  if (status === 'blocked' || status === 'failed' || status === 'unavailable') return 'red';
  if (status === 'needs_confirmation' || status === 'pending') return 'orange';
  if (status === 'executed') return 'blue';
  return 'gray';
}

function blockerSummary(blocker: string): string {
  if (blocker === 'approved_files_required') return 'Select or approve the files GitKeeper is allowed to commit.';
  if (blocker === 'dirty_files_not_approved') return 'The dirty files are visible, but none are approved for commit yet.';
  if (blocker === 'left_behind_dirty_files_require_review') return 'Some dirty files are outside the approved set and need review.';
  if (blocker === 'repo_path_missing') return 'This repository path is missing on one of the machines.';
  return blocker.replaceAll('_', ' ');
}

const MachineNode: React.FC<{ machine: GitKeeperPopupMachine }> = ({ machine }) => {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.machineNode} ${machine.role === 'source' ? styles.machineNodeSource : ''} ${
        machine.available ? '' : styles.machineNodeUnavailable
      }`}
    >
      <div className='flex items-center justify-between gap-6px'>
        <div className='flex items-center gap-6px min-w-0'>
          <span className='text-t-secondary flex items-center'>{machineIcon(machine)}</span>
          <span className='text-13px font-semibold text-t-primary overflow-hidden text-ellipsis whitespace-nowrap'>
            {machine.label}
          </span>
        </div>
        <Tag size='small' color={machine.available ? 'green' : 'red'}>
          {machine.available
            ? t('conversation.workspace.gitkeeper.machineOnline')
            : t('conversation.workspace.gitkeeper.machineOffline')}
        </Tag>
      </div>
      <div className='text-12px text-t-tertiary mt-8px'>{machine.role}</div>
    </div>
  );
};

const MachineFlowRail: React.FC<{ state: GitKeeperPopupState }> = ({ state }) => {
  const source = state.machines.find((machine) => machine.role === 'source');
  const peers = state.machines.filter((machine) => machine.role === 'peer');

  if (!source) return null;

  return (
    <div className={styles.flowRailGrid}>
      <div className={styles.flowSourceSlot}>
        <MachineNode machine={source} />
      </div>
      <div className={styles.flowPeerStack}>
        {peers.map((peer) => {
          const flow = state.flows.find((item) => item.to === peer.machine);
          const unavailable = !peer.available || flow?.status === 'failed';
          return (
            <div key={peer.machine} className={styles.flowPeerRow}>
              <div className={`${styles.syncArrow} ${unavailable ? styles.syncArrowBlocked : styles.syncArrowActive}`}>
                <span className={styles.syncArrowLine} />
                {unavailable ? <CloseOne className={styles.syncArrowCross} size={14} /> : <Right className={styles.syncArrowHead} size={16} />}
              </div>
              <MachineNode machine={peer} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RepoCard: React.FC<{
  card: GitKeeperPopupRepoCard;
  approvedCard?: GitKeeperAdvisoryResponse['cards'][number];
  executing: boolean;
  onSync: (card: GitKeeperPopupRepoCard) => void;
}> = ({ card, approvedCard, executing, onSync }) => {
  const { t } = useTranslation();
  const dirtyCount = card.dirtyFiles.length + card.leftBehindFiles.length;
  const blocked = card.blockers.length > 0 || card.status === 'blocked';
  const canSync = Boolean(approvedCard) || (dirtyCount === 0 && card.blockers.length === 0);
  const visibleApprovedFiles = new Set([...(card.selectedFiles ?? []), ...(approvedCard?.approvedFiles ?? [])]);

  return (
    <div className={styles.repoCard}>
      <div className={styles.repoCardHeader}>
        <div className='flex items-center gap-8px min-w-0'>
          <Branch size={16} fill={iconColors.secondary} />
          <div className='min-w-0'>
            <div className='text-13px font-semibold text-t-primary overflow-hidden text-ellipsis whitespace-nowrap'>
              {card.repositoryId}
            </div>
            <div className='text-11px text-t-tertiary overflow-hidden text-ellipsis whitespace-nowrap'>
              {card.operationId}
            </div>
          </div>
        </div>
        <Tag size='small' color={statusColor(card.status)}>
          {card.status}
        </Tag>
      </div>
      <div className={styles.repoCardBody}>
        <div className='grid grid-cols-3 gap-8px mb-10px'>
          <div className='text-12px text-t-secondary'>
            <div className='font-semibold text-t-primary'>{dirtyCount}</div>
            <div>{t('conversation.workspace.gitkeeper.dirtyFiles')}</div>
          </div>
          <div className='text-12px text-t-secondary'>
            <div className='font-semibold text-t-primary'>{card.blockers.length}</div>
            <div>{t('conversation.workspace.gitkeeper.blockers')}</div>
          </div>
          <div className='text-12px text-t-secondary'>
            <div className='font-semibold text-t-primary'>{card.recommendedActions.length}</div>
            <div>{t('conversation.workspace.gitkeeper.actions')}</div>
          </div>
        </div>

        {card.dirtyFiles.length > 0 || card.leftBehindFiles.length > 0 ? (
          <div className={`${styles.fileList} mb-10px`}>
            {[...new Set([...card.dirtyFiles, ...card.leftBehindFiles])].map((file) => (
              <div key={file} className={styles.fileRow}>
                <span className='text-12px text-t-secondary font-mono overflow-hidden text-ellipsis whitespace-nowrap'>
                  {file}
                </span>
                <Tag size='small' color={visibleApprovedFiles.has(file) ? 'green' : 'orange'}>
                  {visibleApprovedFiles.has(file)
                    ? t('conversation.workspace.gitkeeper.approved')
                    : t('conversation.workspace.gitkeeper.needsApproval')}
                </Tag>
              </div>
            ))}
          </div>
        ) : (
          <div className='flex items-center gap-6px text-12px text-success-6 mb-10px'>
            <CheckOne size={14} />
            <span>{t('conversation.workspace.gitkeeper.clean')}</span>
          </div>
        )}

        {blocked && (
          <Alert
            className='mb-10px'
            type={approvedCard ? 'info' : 'warning'}
            title={t('conversation.workspace.gitkeeper.blockedTitle')}
            content={
              <div className='flex flex-col gap-4px'>
                {approvedCard ? (
                  <div>{approvedCard.recommendation}</div>
                ) : (
                  card.blockers.map((blocker) => (
                    <div key={blocker}>{blockerSummary(blocker)}</div>
                  ))
                )}
              </div>
            }
          />
        )}

        <div className='flex flex-col gap-6px mb-10px'>
          {card.peerState.map((peer) => (
            <div key={peer.machine} className='flex items-center justify-between gap-8px text-12px'>
              <span className='text-t-secondary overflow-hidden text-ellipsis whitespace-nowrap'>{peer.machine}</span>
              <Tag size='small' color={statusColor(peer.status)}>
                {peer.status}
              </Tag>
            </div>
          ))}
        </div>

        {card.recommendedActions.length > 0 && (
          <div className='flex flex-col gap-6px'>
            {card.recommendedActions.map((action) => (
              <div key={`${action.order}-${action.action}`} className='text-12px text-t-secondary flex gap-6px'>
                <Right size={12} className='mt-2px flex-shrink-0' />
                <span>{action.summary}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.repoActionBar}>
          <div className='text-12px text-t-secondary'>
            {approvedCard
              ? t('conversation.workspace.gitkeeper.approvedPlanReady')
              : canSync
              ? t('conversation.workspace.gitkeeper.readyToSync')
              : t('conversation.workspace.gitkeeper.syncBlockedHint')}
          </div>
          <Button size='small' type='primary' loading={executing} disabled={!canSync || executing} onClick={() => onSync(card)}>
            {t('conversation.workspace.gitkeeper.syncNow')}
          </Button>
        </div>
      </div>
    </div>
  );
};

const PopupBody: React.FC<{
  state: GitKeeperPopupState;
  approvedCards: GitKeeperAdvisoryResponse['cards'];
  executing: boolean;
  onSync: (card: GitKeeperPopupRepoCard) => void;
}> = ({ state, approvedCards, executing, onSync }) => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col gap-14px'>
      <MachineFlowRail state={state} />

      <div className='flex flex-col gap-10px'>
        {state.repoCards.map((card) => (
          <RepoCard
            key={card.operationId}
            card={card}
            approvedCard={approvedCards.find((approved) => approved.repositoryId === card.repositoryId)}
            executing={executing}
            onSync={onSync}
          />
        ))}
      </div>

      {state.advisory.required && (
        <Alert type='warning' content={t('conversation.workspace.gitkeeper.advisoryRequired')} />
      )}
    </div>
  );
};

const AdvisoryPanel: React.FC<{
  advisory: GitKeeperAdvisoryResponse | null;
  loading: boolean;
  error: string | null;
  approved: boolean;
  question: string;
  onQuestionChange: (value: string) => void;
  onSend: () => void;
  onApprove: () => void;
}> = ({ advisory, loading, error, approved, question, onQuestionChange, onSend, onApprove }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.advisoryPanel}>
      <div className='flex items-center justify-between gap-8px mb-10px'>
        <div>
          <div className='text-13px font-semibold text-t-primary'>
            {t('conversation.workspace.gitkeeper.codexAdvisoryTitle')}
          </div>
          <div className='text-12px text-t-tertiary'>
            {advisory?.temporaryThreadId ?? t('conversation.workspace.gitkeeper.codexAdvisoryPreparing')}
          </div>
        </div>
        {loading && <Spin size={16} />}
      </div>

      {error && <Alert className='mb-10px' type='error' content={error} />}

      {advisory?.cards.map((card) => (
        <div key={card.repositoryId} className={styles.recommendationCard}>
          <div className='text-13px font-semibold text-t-primary mb-4px'>{card.repositoryId}</div>
          <div className='text-12px text-t-secondary mb-6px'>{card.summary}</div>
          <div className='text-12px text-t-primary mb-8px'>{card.recommendation}</div>
          <div className='flex flex-wrap gap-6px mb-8px'>
            {card.approvedFiles.map((file) => (
              <Tag key={file} size='small' color='green'>
                {file}
              </Tag>
            ))}
          </div>
          <div className='text-12px text-t-secondary'>
            {t('conversation.workspace.gitkeeper.commitMessage')}: {card.commitMessage}
          </div>
          {card.risks.length > 0 && (
            <div className='text-12px text-warning-6 mt-6px'>{card.risks.join(' ')}</div>
          )}
        </div>
      ))}

      {advisory?.answer && <div className={styles.codexAnswer}>{advisory.answer}</div>}

      {advisory && advisory.cards.length > 0 && (
        <div className={styles.approvalRow}>
          <div className='text-12px text-t-secondary'>
            {approved
              ? t('conversation.workspace.gitkeeper.planApproved')
              : t('conversation.workspace.gitkeeper.planApprovalHint')}
          </div>
          <Button type='primary' size='small' disabled={approved || loading} onClick={onApprove}>
            {approved
              ? t('conversation.workspace.gitkeeper.planApprovedButton')
              : t('conversation.workspace.gitkeeper.approvePlan')}
          </Button>
        </div>
      )}

      <div className={styles.chatRow}>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          value={question}
          placeholder={t('conversation.workspace.gitkeeper.codexChatPlaceholder')}
          onChange={onQuestionChange}
        />
        <Button type='primary' loading={loading} disabled={!question.trim()} onClick={onSend}>
          {t('conversation.workspace.gitkeeper.askCodex')}
        </Button>
      </div>
    </div>
  );
};

const GitKeeperPopup: React.FC<GitKeeperPopupProps> = ({ workspace, conversationId }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GitKeeperPopupState | null>(null);
  const [advisory, setAdvisory] = useState<GitKeeperAdvisoryResponse | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);
  const [advisoryQuestion, setAdvisoryQuestion] = useState('');
  const [approvedCards, setApprovedCards] = useState<GitKeeperAdvisoryResponse['cards']>([]);
  const [executing, setExecuting] = useState(false);

  const buildAutomaticPlan = useCallback((popupState: GitKeeperPopupState): GitKeeperAdvisoryResponse['cards'] => {
    const stateWithSource = popupState as GitKeeperPopupStateWithSource;
    return popupState.repoCards.flatMap((card) => {
      const dirtyFiles = [...new Set([...card.dirtyFiles, ...card.leftBehindFiles])];
      const approvalOnlyBlockers = card.blockers.every((blocker) =>
        ['approved_files_required', 'dirty_files_not_approved'].includes(blocker)
      );
      const peersAvailable = card.peerState.every((peer) => peer.available);
      if (dirtyFiles.length === 0 && card.blockers.length === 0) {
        return [{
          repositoryId: card.repositoryId,
          summary: 'Repository is clean on the source machine.',
          recommendation: 'GitKeeper can push the source branch and fast-forward available peers.',
          approvedFiles: [],
          commitMessage: '',
          risks: [],
        }];
      }
      if (!approvalOnlyBlockers || !peersAvailable || dirtyFiles.length === 0) return [];

      const dashboardCards = stateWithSource.source?.dashboard?.cards?.filter(
        (item) => item.repositoryId === card.repositoryId
      ) ?? [];
      const onlySourceDirty = dashboardCards.length > 0
        ? dashboardCards.every((item) => item.machine === popupState.sourceMachine || (item.dirtySummary?.dirtyCount ?? 0) === 0)
        : true;

      if (!onlySourceDirty) return [];

      const repoName = card.repositoryId.split('/').at(-1) ?? card.repositoryId;
      return [{
        repositoryId: card.repositoryId,
        summary: `Dirty files are isolated to ${popupState.sourceMachine}: ${dirtyFiles.join(', ')}.`,
        recommendation: 'GitKeeper can commit these source files, push, and fast-forward the clean peers.',
        approvedFiles: dirtyFiles,
        commitMessage: `Update ${repoName}`,
        risks: [],
      }];
    });
  }, []);

  const needsAdvisory = useCallback((popupState: GitKeeperPopupState) => {
    const automaticCards = buildAutomaticPlan(popupState);
    const unresolvedCards = popupState.repoCards.filter((card) => {
      const dirtyCount = card.dirtyFiles.length + card.leftBehindFiles.length;
      const hasAutoCard = automaticCards.some((item) => item.repositoryId === card.repositoryId);
      return dirtyCount > 0 && !hasAutoCard;
    });
    return popupState.advisory.required || unresolvedCards.length > 0;
  }, [buildAutomaticPlan]);

  const loadAdvisory = useCallback(
    async (popupState: GitKeeperPopupState, question = '') => {
      setAdvisoryLoading(true);
      setAdvisoryError(null);
      try {
        const result = await ipcBridge.gitkeeper.getAdvisory.invoke({
          workspace,
          threadId: conversationId,
          question,
          state: popupState,
        });
        if (!result.success || !result.data) {
          throw new Error(result.msg || t('conversation.workspace.gitkeeper.codexAdvisoryFailed'));
        }
        setAdvisory(result.data);
      } catch (err) {
        setAdvisoryError(err instanceof Error ? err.message : String(err));
      } finally {
        setAdvisoryLoading(false);
      }
    },
    [conversationId, t, workspace]
  );

  const loadPopupState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipcBridge.gitkeeper.getPopupState.invoke({
        workspace,
        host: 'kodo_aoin_workbench',
        threadId: conversationId,
      });
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('conversation.workspace.gitkeeper.loadFailed'));
      }
      setState(result.data);
      setAdvisory(null);
      setAdvisoryQuestion('');
      const automaticCards = buildAutomaticPlan(result.data);
      setApprovedCards(automaticCards);
      if (needsAdvisory(result.data)) {
        void loadAdvisory(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildAutomaticPlan, conversationId, loadAdvisory, needsAdvisory, t, workspace]);

  const sendAdvisoryQuestion = useCallback(() => {
    if (!state || !advisoryQuestion.trim()) return;
    void loadAdvisory(state, advisoryQuestion.trim());
    setAdvisoryQuestion('');
    setApprovedCards([]);
  }, [advisoryQuestion, loadAdvisory, state]);

  const approveCurrentPlan = useCallback(() => {
    if (!advisory) return;
    setApprovedCards(advisory.cards);
  }, [advisory]);

  const executeApprovedPlan = useCallback(async (card: GitKeeperPopupRepoCard) => {
    if (!state) return;
    const approvedCard = approvedCards.find((item) => item.repositoryId === card.repositoryId);
    const executionCards: GitKeeperAdvisoryResponse['cards'] = approvedCard
      ? [approvedCard]
      : [
          {
            repositoryId: card.repositoryId,
            summary: 'Clean repo sync',
            recommendation: 'Push current source branch and fast-forward peers.',
            approvedFiles: [],
            commitMessage: '',
            risks: [],
          },
        ];
    setExecuting(true);
    setError(null);
    try {
      const result = await ipcBridge.gitkeeper.executeApprovedPlan.invoke({
        workspace,
        sourceMachine: state.sourceMachine,
        threadId: conversationId,
        cards: executionCards,
      });
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('conversation.workspace.gitkeeper.executeFailed'));
      }
      await loadPopupState();
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  }, [approvedCards, conversationId, loadPopupState, state, t, workspace]);

  const openPopup = useCallback(() => {
    setVisible(true);
    void loadPopupState();
  }, [loadPopupState]);

  return (
    <>
      <Tooltip content={t('conversation.workspace.gitkeeper.open')}>
        <span>
          <DatabaseSync
            className='workspace-toolbar-icon-btn flex cursor-pointer'
            theme='outline'
            size='16'
            fill={iconColors.secondary}
            onClick={openPopup}
          />
        </span>
      </Tooltip>
      <Modal
        title={t('conversation.workspace.gitkeeper.title')}
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={
          <div className='flex items-center justify-end gap-8px'>
            <Button icon={<Refresh size={14} />} loading={loading} onClick={() => void loadPopupState()}>
              {t('conversation.workspace.gitkeeper.refresh')}
            </Button>
            <Button type='primary' onClick={() => setVisible(false)}>
              {t('common.close')}
            </Button>
          </div>
        }
        style={{ width: 720 }}
      >
        {loading && !state ? (
          <div className='h-240px flex items-center justify-center'>
            <Spin />
          </div>
        ) : error ? (
          <Alert type='error' content={error} />
        ) : state ? (
          <>
            <PopupBody
              state={state}
              approvedCards={approvedCards}
              executing={executing}
              onSync={executeApprovedPlan}
            />
            {needsAdvisory(state) && (
              <div className='mt-12px'>
                <AdvisoryPanel
                  advisory={advisory}
                  loading={advisoryLoading}
                  error={advisoryError}
                  approved={approvedCards.length > 0}
                  question={advisoryQuestion}
                  onQuestionChange={setAdvisoryQuestion}
                  onSend={sendAdvisoryQuestion}
                  onApprove={approveCurrentPlan}
                />
              </div>
            )}
          </>
        ) : (
          <Empty description={t('conversation.workspace.gitkeeper.empty')} />
        )}
      </Modal>
    </>
  );
};

export default GitKeeperPopup;
