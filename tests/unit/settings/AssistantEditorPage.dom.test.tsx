/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigProvider } from '@arco-design/web-react';
import AssistantEditorPage from '@/renderer/pages/settings/AssistantSettings/AssistantEditorPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

vi.mock('@/renderer/pages/settings/AssistantSettings/AssistantEditorSections', () => ({
  default: () => <div data-testid='assistant-editor-sections' />,
}));

describe('AssistantEditorPage', () => {
  it('renders a single assistant-editor-page test id', () => {
    render(
      <ConfigProvider>
        <AssistantEditorPage
          isCreating={true}
          activeAssistant={null}
          editName=''
          setEditName={vi.fn()}
          editDescription=''
          setEditDescription={vi.fn()}
          editAvatar='🤖'
          setEditAvatar={vi.fn()}
          editAgent='claude'
          setEditAgent={vi.fn()}
          editRecommendedPromptsText=''
          setEditRecommendedPromptsText={vi.fn()}
          defaultModelMode='auto'
          setDefaultModelMode={vi.fn()}
          defaultModelValue=''
          setDefaultModelValue={vi.fn()}
          defaultPermissionMode='auto'
          setDefaultPermissionMode={vi.fn()}
          defaultPermissionValue=''
          setDefaultPermissionValue={vi.fn()}
          defaultSkillsMode='auto'
          setDefaultSkillsMode={vi.fn()}
          defaultMcpMode='auto'
          setDefaultMcpMode={vi.fn()}
          availableMcpServers={[]}
          selectedMcpIds={[]}
          setSelectedMcpIds={vi.fn()}
          editContext=''
          setEditContext={vi.fn()}
          promptViewMode='preview'
          setPromptViewMode={vi.fn()}
          availableSkills={[]}
          selectedSkills={[]}
          setSelectedSkills={vi.fn()}
          pendingSkills={[]}
          setDeletePendingSkillName={vi.fn()}
          setDeleteCustomSkillName={vi.fn()}
          builtinAutoSkills={[]}
          disabledBuiltinSkills={[]}
          setDisabledBuiltinSkills={vi.fn()}
          isExtensionAssistant={() => false}
          availableBackends={[]}
          handleSave={vi.fn()}
          handleDeleteClick={vi.fn()}
          handleDuplicate={vi.fn()}
          onBack={vi.fn()}
        />
      </ConfigProvider>
    );

    expect(screen.getAllByTestId('assistant-editor-page')).toHaveLength(1);
    expect(screen.getByTestId('assistant-editor-bar')).toHaveClass('sticky');
    expect(screen.getByTestId('assistant-editor-body')).toBeInTheDocument();
  });
});
