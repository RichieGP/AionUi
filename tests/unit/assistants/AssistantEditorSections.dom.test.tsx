import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from '@arco-design/web-react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssistantEditorSections from '@/renderer/pages/settings/AssistantSettings/AssistantEditorSections';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; count?: number }) => {
      if (options?.defaultValue) return options.defaultValue.replace('{{count}}', String(options.count ?? ''));
      return _key;
    },
  }),
}));

vi.mock('@/renderer/hooks/agent/useModelProviderList', () => ({
  useModelProviderList: () => ({
    providers: [],
    getAvailableModels: () => [],
  }),
}));

vi.mock('@/renderer/components/chat/EmojiPicker', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <ConfigProvider>{ui}</ConfigProvider>
    </MemoryRouter>
  );

describe('AssistantEditorSections', () => {
  it('renders all default configuration rows in a single card', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText={'Prompt one\nPrompt two'}
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[]}
        selectedMcpIds={['filesystem']}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
        setEditContext={vi.fn()}
        promptViewMode='preview'
        setPromptViewMode={vi.fn()}
        availableSkills={[
          { name: 'browse', description: 'Browse the web', location: '', is_custom: false, source: 'builtin' },
        ]}
        selectedSkills={['browse']}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    const defaultsCard = screen.getByTestId('assistant-card-defaults');
    const defaultsScope = within(defaultsCard);
    expect(defaultsScope.getByText('Default Model')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default Permission')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default Skills')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default MCP')).toBeInTheDocument();
  });

  it('renders recommended prompts as a list with actions', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText={'Prompt one\nPrompt two'}
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[]}
        selectedMcpIds={[]}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
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
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    const promptCard = screen.getByTestId('assistant-card-prompts');
    const promptScope = within(promptCard);
    expect(promptScope.getByText('Prompt one')).toBeInTheDocument();
    expect(promptScope.getByText('Prompt two')).toBeInTheDocument();
    expect(promptScope.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
