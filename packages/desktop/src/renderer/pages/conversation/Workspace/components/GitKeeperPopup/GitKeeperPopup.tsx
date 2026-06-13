/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { GitKeeperPopupMachine, GitKeeperPopupRepoCard, GitKeeperPopupState } from '@/common/adapter/ipcBridge';
import { iconColors } from '@/renderer/styles/colors';
import { Alert, Button, Empty, Modal, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Apple, Branch, CheckOne, CodeLaptop, Computer, DatabaseSync, Refresh, Right } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './GitKeeperPopup.module.css';

type GitKeeperPopupProps = {
  workspace: string;
  conversationId: string;
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

const RepoCard: React.FC<{ card: GitKeeperPopupRepoCard }> = ({ card }) => {
  const { t } = useTranslation();
  const dirtyCount = card.dirtyFiles.length + card.leftBehindFiles.length;

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
            {[...card.dirtyFiles, ...card.leftBehindFiles].map((file) => (
              <div key={file} className={`${styles.fileRow} text-12px text-t-secondary font-mono`}>
                {file}
              </div>
            ))}
          </div>
        ) : (
          <div className='flex items-center gap-6px text-12px text-success-6 mb-10px'>
            <CheckOne size={14} />
            <span>{t('conversation.workspace.gitkeeper.clean')}</span>
          </div>
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
      </div>
    </div>
  );
};

const PopupBody: React.FC<{ state: GitKeeperPopupState }> = ({ state }) => {
  const { t } = useTranslation();
  const sourceMachine = useMemo(() => state.machines.find((machine) => machine.role === 'source'), [state.machines]);

  return (
    <div className='flex flex-col gap-14px'>
      <div className={styles.machineRail}>
        {state.machines.map((machine) => (
          <MachineNode key={machine.machine} machine={machine} />
        ))}
      </div>
      {sourceMachine && state.flows.length > 0 && (
        <div className='flex items-center gap-8px text-12px text-t-secondary'>
          <span className='font-semibold text-t-primary'>{sourceMachine.label}</span>
          <div className={styles.flowLine} />
          <span>{state.flows.map((flow) => flow.to).join(', ')}</span>
        </div>
      )}

      <div className='flex flex-col gap-10px'>
        {state.repoCards.map((card) => (
          <RepoCard key={card.operationId} card={card} />
        ))}
      </div>

      {state.advisory.required && (
        <Alert type='warning' content={t('conversation.workspace.gitkeeper.advisoryRequired')} />
      )}
    </div>
  );
};

const GitKeeperPopup: React.FC<GitKeeperPopupProps> = ({ workspace, conversationId }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GitKeeperPopupState | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId, t, workspace]);

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
          <PopupBody state={state} />
        ) : (
          <Empty description={t('conversation.workspace.gitkeeper.empty')} />
        )}
      </Modal>
    </>
  );
};

export default GitKeeperPopup;
