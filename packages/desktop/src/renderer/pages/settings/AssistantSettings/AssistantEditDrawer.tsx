/**
 * Legacy drawer wrapper retained temporarily while the full-page editor rolls out.
 * The settings page no longer uses this component as the primary editor surface.
 */
import type { AssistantListItem, BuiltinAutoSkill, SkillInfo } from './types';
import type { IMcpServer } from '@/common/config/storage';
import type { AvailableBackend } from '@/renderer/hooks/assistant';
import { Button, Drawer } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantEditorSections from './AssistantEditorSections';

type AssistantEditDrawerProps = {
  editVisible: boolean;
  setEditVisible: (visible: boolean) => void;
  isCreating: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editAvatar: string;
  setEditAvatar: (value: string) => void;
  editAvatarImage?: string;
  editAgent: string;
  setEditAgent: (value: string) => void;
  editRecommendedPromptsText: string;
  setEditRecommendedPromptsText: (value: string) => void;
  defaultModelMode: 'auto' | 'fixed';
  setDefaultModelMode: (value: 'auto' | 'fixed') => void;
  defaultModelValue: string;
  setDefaultModelValue: (value: string) => void;
  defaultPermissionMode: 'auto' | 'fixed';
  setDefaultPermissionMode: (value: 'auto' | 'fixed') => void;
  defaultPermissionValue: string;
  setDefaultPermissionValue: (value: string) => void;
  defaultSkillsMode: 'auto' | 'fixed';
  setDefaultSkillsMode: (value: 'auto' | 'fixed') => void;
  defaultMcpMode: 'auto' | 'fixed';
  setDefaultMcpMode: (value: 'auto' | 'fixed') => void;
  availableMcpServers: IMcpServer[];
  selectedMcpIds: string[];
  setSelectedMcpIds: (value: string[]) => void;
  editContext: string;
  setEditContext: (value: string) => void;
  promptViewMode: 'edit' | 'preview';
  setPromptViewMode: (value: 'edit' | 'preview') => void;
  availableSkills: SkillInfo[];
  selectedSkills: string[];
  setSelectedSkills: (value: string[]) => void;
  pendingSkills: Array<{ name: string; description: string }>;
  customSkills: string[];
  setDeletePendingSkillName: (value: string | null) => void;
  setDeleteCustomSkillName: (value: string | null) => void;
  builtinAutoSkills: BuiltinAutoSkill[];
  disabledBuiltinSkills: string[];
  setDisabledBuiltinSkills: (value: string[]) => void;
  activeAssistant: AssistantListItem | null;
  activeAssistantId: string | null;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  availableBackends: AvailableBackend[];
  handleSave: () => void;
  handleDeleteClick: () => void;
  handleDuplicate: (assistant: AssistantListItem) => void;
};

const AssistantEditDrawer: React.FC<AssistantEditDrawerProps> = ({
  editVisible,
  setEditVisible,
  isCreating,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editAvatar,
  setEditAvatar,
  editAvatarImage,
  editAgent,
  setEditAgent,
  editRecommendedPromptsText,
  setEditRecommendedPromptsText,
  defaultModelMode,
  setDefaultModelMode,
  defaultModelValue,
  setDefaultModelValue,
  defaultPermissionMode,
  setDefaultPermissionMode,
  defaultPermissionValue,
  setDefaultPermissionValue,
  defaultSkillsMode,
  setDefaultSkillsMode,
  defaultMcpMode,
  setDefaultMcpMode,
  availableMcpServers,
  selectedMcpIds,
  setSelectedMcpIds,
  editContext,
  setEditContext,
  promptViewMode,
  setPromptViewMode,
  availableSkills,
  selectedSkills,
  setSelectedSkills,
  pendingSkills,
  customSkills: _customSkills,
  setDeletePendingSkillName,
  setDeleteCustomSkillName,
  builtinAutoSkills,
  disabledBuiltinSkills,
  setDisabledBuiltinSkills,
  activeAssistant,
  activeAssistantId: _activeAssistantId,
  isExtensionAssistant,
  availableBackends,
  handleSave,
  handleDeleteClick,
  handleDuplicate,
}) => {
  const { t } = useTranslation();
  const [drawerWidth, setDrawerWidth] = useState(500);

  useEffect(() => {
    const updateDrawerWidth = () => {
      if (typeof window === 'undefined') return;
      const nextWidth = Math.min(1024, Math.max(480, Math.floor(window.innerWidth * 0.5)));
      setDrawerWidth(nextWidth);
    };

    updateDrawerWidth();
    window.addEventListener('resize', updateDrawerWidth);
    return () => window.removeEventListener('resize', updateDrawerWidth);
  }, []);

  return (
    <Drawer
      title={
        <>
          <span>
            {isCreating
              ? t('settings.createAssistant', { defaultValue: 'Create Assistant' })
              : t('settings.editAssistant', { defaultValue: 'Assistant Details' })}
          </span>
          <Button
            type='text'
            size='mini'
            onClick={(event) => {
              event.stopPropagation();
              setEditVisible(false);
            }}
            className='absolute right-4 top-2 !min-w-0 text-t-secondary hover:text-t-primary transition-colors p-1'
            style={{ zIndex: 10, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Close size={18} />
          </Button>
        </>
      }
      closable={false}
      visible={editVisible}
      placement='right'
      width={drawerWidth}
      zIndex={1200}
      getPopupContainer={() => document.body}
      autoFocus={false}
      onCancel={() => {
        setEditVisible(false);
      }}
      headerStyle={{ background: 'var(--color-bg-1)' }}
      bodyStyle={{ background: 'var(--color-bg-1)' }}
      footer={
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-8px'>
            <Button
              type='primary'
              onClick={handleSave}
              data-testid='btn-save-assistant'
              className='w-[100px] rounded-[100px]'
            >
              {isCreating ? t('common.create', { defaultValue: 'Create' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
            <Button onClick={() => setEditVisible(false)} className='w-[100px] rounded-[100px] bg-fill-2'>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
          {!isCreating && activeAssistant?.source !== 'builtin' && !isExtensionAssistant(activeAssistant) && (
            <Button
              status='danger'
              onClick={handleDeleteClick}
              data-testid='btn-delete-assistant'
              className='rounded-[100px]'
              style={{ backgroundColor: 'rgb(var(--danger-1))' }}
            >
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          )}
        </div>
      }
    >
      <div className='flex flex-col h-full overflow-hidden' data-testid='assistant-edit-drawer'>
        <div className='flex-1 overflow-y-auto'>
          <AssistantEditorSections
            isCreating={isCreating}
            editName={editName}
            setEditName={setEditName}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editAvatar={editAvatar}
            setEditAvatar={setEditAvatar}
            editAvatarImage={editAvatarImage}
            editAgent={editAgent}
            setEditAgent={setEditAgent}
            editRecommendedPromptsText={editRecommendedPromptsText}
            setEditRecommendedPromptsText={setEditRecommendedPromptsText}
            defaultModelMode={defaultModelMode}
            setDefaultModelMode={setDefaultModelMode}
            defaultModelValue={defaultModelValue}
            setDefaultModelValue={setDefaultModelValue}
            defaultPermissionMode={defaultPermissionMode}
            setDefaultPermissionMode={setDefaultPermissionMode}
            defaultPermissionValue={defaultPermissionValue}
            setDefaultPermissionValue={setDefaultPermissionValue}
            defaultSkillsMode={defaultSkillsMode}
            setDefaultSkillsMode={setDefaultSkillsMode}
            defaultMcpMode={defaultMcpMode}
            setDefaultMcpMode={setDefaultMcpMode}
            availableMcpServers={availableMcpServers}
            selectedMcpIds={selectedMcpIds}
            setSelectedMcpIds={setSelectedMcpIds}
            editContext={editContext}
            setEditContext={setEditContext}
            promptViewMode={promptViewMode}
            setPromptViewMode={setPromptViewMode}
            availableSkills={availableSkills}
            selectedSkills={selectedSkills}
            setSelectedSkills={setSelectedSkills}
            pendingSkills={pendingSkills}
            setDeletePendingSkillName={setDeletePendingSkillName}
            setDeleteCustomSkillName={setDeleteCustomSkillName}
            builtinAutoSkills={builtinAutoSkills}
            disabledBuiltinSkills={disabledBuiltinSkills}
            setDisabledBuiltinSkills={setDisabledBuiltinSkills}
            activeAssistant={activeAssistant}
            isExtensionAssistant={isExtensionAssistant}
            availableBackends={availableBackends}
            handleDuplicate={handleDuplicate}
          />
        </div>
      </div>
    </Drawer>
  );
};

export default AssistantEditDrawer;
