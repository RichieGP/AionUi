import type { AssistantListItem, BuiltinAutoSkill, SkillInfo } from './types';
import type { AvailableBackend } from '@/renderer/hooks/assistant';
import EmojiPicker from '@/renderer/components/chat/EmojiPicker';
import MarkdownView from '@/renderer/components/Markdown';
import { Avatar, Button, Checkbox, Collapse, Input, Select, Tag, Typography } from '@arco-design/web-react';
import { Delete, Info, Plus, Robot } from '@icon-park/react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export type AssistantEditorSectionsProps = {
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
  editContext: string;
  setEditContext: (value: string) => void;
  promptViewMode: 'edit' | 'preview';
  setPromptViewMode: (value: 'edit' | 'preview') => void;
  availableSkills: SkillInfo[];
  selectedSkills: string[];
  setSelectedSkills: (value: string[]) => void;
  pendingSkills: Array<{ name: string; description: string }>;
  setDeletePendingSkillName: (value: string | null) => void;
  setDeleteCustomSkillName: (value: string | null) => void;
  builtinAutoSkills: BuiltinAutoSkill[];
  disabledBuiltinSkills: string[];
  setDisabledBuiltinSkills: (value: string[]) => void;
  activeAssistant: AssistantListItem | null;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  availableBackends: AvailableBackend[];
  handleDuplicate: (assistant: AssistantListItem) => void;
};

const AssistantEditorSections: React.FC<AssistantEditorSectionsProps> = ({
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
  editContext,
  setEditContext,
  promptViewMode,
  setPromptViewMode,
  availableSkills,
  selectedSkills,
  setSelectedSkills,
  pendingSkills,
  setDeletePendingSkillName,
  setDeleteCustomSkillName,
  builtinAutoSkills,
  disabledBuiltinSkills,
  setDisabledBuiltinSkills,
  activeAssistant,
  isExtensionAssistant,
  availableBackends,
  handleDuplicate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const textareaWrapperRef = useRef<HTMLDivElement>(null);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  useEffect(() => {
    if (promptViewMode === 'edit') {
      const timer = setTimeout(() => {
        const textarea = textareaWrapperRef.current?.querySelector('textarea');
        textarea?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [promptViewMode]);

  const showSkills = isCreating || (activeAssistant !== null && activeAssistant.source !== 'extension');
  const customSkillItems = availableSkills.filter((skill) => skill.source === 'custom');
  const builtinSkillItems = availableSkills.filter((skill) => skill.source === 'builtin');
  const extensionSkillItems = availableSkills.filter((skill) => skill.source === 'extension');
  const customActiveCount = selectedSkills.filter(
    (name) =>
      pendingSkills.some((skill) => skill.name === name) || customSkillItems.some((skill) => skill.name === name)
  ).length;
  const builtinActiveCount = selectedSkills.filter((name) =>
    builtinSkillItems.some((skill) => skill.name === name)
  ).length;
  const extensionActiveCount = selectedSkills.filter((name) =>
    extensionSkillItems.some((skill) => skill.name === name)
  ).length;
  const autoInjectedActiveCount = builtinAutoSkills.filter(
    (skill) => !disabledBuiltinSkills.includes(skill.name)
  ).length;
  const customStatusDotColor = customActiveCount > 0 ? 'rgb(var(--success-6))' : 'var(--color-text-4)';
  const builtinStatusDotColor = builtinActiveCount > 0 ? 'rgb(var(--success-6))' : 'var(--color-text-4)';
  const extensionStatusDotColor = extensionActiveCount > 0 ? 'rgb(var(--success-6))' : 'var(--color-text-4)';
  const autoInjectedStatusDotColor = autoInjectedActiveCount > 0 ? 'rgb(var(--success-6))' : 'var(--color-text-4)';
  const totalSkillsCount =
    pendingSkills.length +
    customSkillItems.length +
    builtinSkillItems.length +
    extensionSkillItems.length +
    builtinAutoSkills.length;
  const totalActiveSkillsCount =
    selectedSkills.filter(
      (name) =>
        pendingSkills.some((skill) => skill.name === name) || availableSkills.some((skill) => skill.name === name)
    ).length + autoInjectedActiveCount;
  const isBuiltin = activeAssistant?.source === 'builtin';
  const isExtension = activeAssistant?.source === 'extension';
  const isRuleEditable = !isBuiltin && !isExtension;
  const isSkillsEditable = isCreating || (!isBuiltin && !isExtension);
  const isProfileEditable = !isBuiltin && !isExtension;
  const isAgentEditable = !isExtension;
  const rulesContainerHeight = rulesExpanded
    ? '420px'
    : isRuleEditable && promptViewMode === 'edit'
      ? '260px'
      : '220px';

  return (
    <div className='flex flex-col gap-16px bg-fill-2 rounded-16px p-20px'>
      {isBuiltin && activeAssistant && (
        <div
          className='flex items-start gap-8px p-12px rd-8px bg-[rgba(var(--primary-6),0.06)] border border-solid border-[rgba(var(--primary-6),0.18)]'
          data-testid='assistant-builtin-readonly-banner'
        >
          <Info theme='outline' size={16} className='mt-2px text-primary-6 flex-shrink-0' />
          <div className='text-13px leading-20px text-t-primary'>
            <span>
              {t('settings.assistantBuiltinReadonlyTip', {
                defaultValue:
                  'This is a builtin assistant. Only Main Agent can be changed. To customize other fields, ',
              })}
            </span>
            <Button
              type='text'
              size='mini'
              className='!px-0 !text-primary-6 hover:!text-primary-7'
              onClick={(event) => {
                event.preventDefault();
                handleDuplicate(activeAssistant);
              }}
              data-testid='link-duplicate-from-banner'
            >
              {t('settings.assistantBuiltinReadonlyDuplicateLink', { defaultValue: 'duplicate it' })}
            </Button>
            <span>{t('settings.assistantBuiltinReadonlyTipSuffix', { defaultValue: '.' })}</span>
          </div>
        </div>
      )}

      <div className='flex-shrink-0'>
        <Typography.Text bold>
          <span className='text-red-500'>*</span> {t('settings.assistantNameAvatar', { defaultValue: 'Name & Avatar' })}
        </Typography.Text>
        <div className='mt-10px flex items-center gap-12px'>
          {!isProfileEditable ? (
            <Avatar shape='square' size={40} className='bg-bg-1 rounded-4px'>
              {editAvatarImage ? (
                <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
              ) : editAvatar ? (
                <span className='text-24px'>{editAvatar}</span>
              ) : (
                <Robot theme='outline' size={20} />
              )}
            </Avatar>
          ) : (
            <EmojiPicker value={editAvatar} onChange={(emoji) => setEditAvatar(emoji)} placement='br'>
              <Button type='text' className='!p-0 !min-w-0 h-auto'>
                <Avatar shape='square' size={40} className='bg-bg-1 rounded-4px hover:bg-fill-2 transition-colors'>
                  {editAvatarImage ? (
                    <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
                  ) : editAvatar ? (
                    <span className='text-24px'>{editAvatar}</span>
                  ) : (
                    <Robot theme='outline' size={20} />
                  )}
                </Avatar>
              </Button>
            </EmojiPicker>
          )}
          <Input
            value={editName}
            onChange={(value) => setEditName(value)}
            disabled={!isProfileEditable}
            placeholder={t('settings.agentNamePlaceholder', { defaultValue: 'Enter a name for this agent' })}
            data-testid='input-assistant-name'
            className='flex-1 rounded-4px bg-bg-1'
          />
        </div>
      </div>

      <div className='flex-shrink-0'>
        <Typography.Text bold>
          {t('settings.assistantDescription', { defaultValue: 'Assistant Description' })}
        </Typography.Text>
        <Input
          className='mt-10px rounded-4px bg-bg-1'
          value={editDescription}
          onChange={(value) => setEditDescription(value)}
          disabled={!isProfileEditable}
          data-testid='input-assistant-desc'
          placeholder={t('settings.assistantDescriptionPlaceholder', {
            defaultValue: 'What can this assistant help with?',
          })}
        />
      </div>

      <div className='flex-shrink-0'>
        <Typography.Text bold>{t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}</Typography.Text>
        <Select
          className='mt-10px w-full rounded-4px'
          value={editAgent}
          onChange={(value) => setEditAgent(value as string)}
          disabled={!isAgentEditable}
          data-testid='select-assistant-agent'
        >
          {availableBackends.map((option) => (
            <Select.Option key={option.id} value={option.id}>
              <span className='flex items-center gap-6px'>
                {option.name}
                {option.isExtension && (
                  <Tag size='small' color='arcoblue'>
                    ext
                  </Tag>
                )}
              </span>
            </Select.Option>
          ))}
        </Select>
      </div>

      <div className='flex flex-wrap items-center gap-8px p-10px rd-10px bg-fill-1'>
        <span className='text-12px text-t-secondary'>
          {t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}:
        </span>
        <Tag size='small' color='arcoblue'>
          {editAgent}
        </Tag>
        <span className='text-12px text-t-secondary ml-6px'>
          {t('settings.assistantSkills', { defaultValue: 'Skills' })}:
        </span>
        <Tag size='small' color={totalActiveSkillsCount > 0 ? 'green' : 'gray'}>
          {totalActiveSkillsCount > 0 ? `${totalActiveSkillsCount}/${totalSkillsCount}` : totalSkillsCount}
        </Tag>
      </div>

      <div className='flex-shrink-0'>
        <div className='flex items-center justify-between'>
          <Typography.Text bold className='flex-shrink-0'>
            {t('settings.assistantRules', { defaultValue: 'Rules' })}
          </Typography.Text>
          <Button
            type='text'
            size='mini'
            data-testid='btn-expand-rules'
            onClick={() => setRulesExpanded((previous) => !previous)}
          >
            {rulesExpanded
              ? t('common.collapse', { defaultValue: 'Collapse' })
              : t('common.expand', { defaultValue: 'Expand' })}
          </Button>
        </div>
        <div
          className='mt-10px border border-border-2 overflow-hidden rounded-4px'
          style={{ height: rulesContainerHeight }}
        >
          {isRuleEditable && (
            <div className='flex items-center h-36px bg-fill-2 border-b border-border-2 flex-shrink-0'>
              <Button
                type='text'
                size='mini'
                className={`!h-full !rounded-none !px-16px text-13px font-medium ${promptViewMode === 'edit' ? '!text-primary border-b-2 border-primary bg-bg-1' : '!text-t-secondary hover:!text-t-primary'}`}
                onClick={() => setPromptViewMode('edit')}
              >
                {t('settings.promptEdit', { defaultValue: 'Edit' })}
              </Button>
              <Button
                type='text'
                size='mini'
                className={`!h-full !rounded-none !px-16px text-13px font-medium ${promptViewMode === 'preview' ? '!text-primary border-b-2 border-primary bg-bg-1' : '!text-t-secondary hover:!text-t-primary'}`}
                onClick={() => setPromptViewMode('preview')}
              >
                {t('settings.promptPreview', { defaultValue: 'Preview' })}
              </Button>
            </div>
          )}
          <div
            className='bg-fill-2'
            style={{
              height: isRuleEditable ? 'calc(100% - 36px)' : '100%',
              overflow: 'auto',
            }}
          >
            {promptViewMode === 'edit' && isRuleEditable ? (
              <div ref={textareaWrapperRef} className='h-full'>
                <Input.TextArea
                  value={editContext}
                  onChange={(value) => setEditContext(value)}
                  placeholder={t('settings.assistantRulesPlaceholder', {
                    defaultValue: 'Enter rules in Markdown format...',
                  })}
                  autoSize={false}
                  className='border-none rounded-none bg-transparent h-full resize-none'
                />
              </div>
            ) : (
              <div className='p-16px text-14px leading-7'>
                {editContext ? (
                  <MarkdownView hiddenCodeCopyButton>{editContext}</MarkdownView>
                ) : (
                  <div className='text-t-secondary text-center py-32px'>
                    {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSkills && (
        <div className='flex-shrink-0 mt-16px' data-testid='skills-section'>
          <div className='flex items-center justify-between mb-12px'>
            <Typography.Text bold>{t('settings.assistantSkills', { defaultValue: 'Skills' })}</Typography.Text>
            {isSkillsEditable && (
              <Button
                size='small'
                type='outline'
                icon={<Plus size={14} />}
                onClick={() => navigate('/settings/capabilities?tab=skills')}
                className='rounded-[100px]'
                data-testid='btn-add-skills'
              >
                {t('settings.addSkills', { defaultValue: 'Add Skills' })}
              </Button>
            )}
          </div>

          <Collapse defaultActiveKey={['custom-skills']} data-testid='skills-collapse'>
            <Collapse.Item
              header={
                <span className='text-13px font-medium'>
                  {t('settings.customSkills', { defaultValue: 'Imported Skills (Library)' })}
                </span>
              }
              name='custom-skills'
              className='mb-8px'
              extra={
                <div className='flex items-center gap-8px'>
                  <span
                    className='inline-block w-8px h-8px rd-50%'
                    style={{ background: customStatusDotColor }}
                    aria-hidden='true'
                  />
                  <span className='text-12px text-t-secondary'>
                    {customActiveCount > 0
                      ? `${customActiveCount}/${pendingSkills.length + customSkillItems.length}`
                      : pendingSkills.length + customSkillItems.length}
                  </span>
                </div>
              }
            >
              <div className='space-y-4px'>
                {pendingSkills.map((skill) => (
                  <div
                    key={`pending-${skill.name}`}
                    className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px group'
                  >
                    <Checkbox
                      checked={selectedSkills.includes(skill.name)}
                      disabled={!isSkillsEditable}
                      className='mt-2px cursor-pointer'
                      onChange={() => {
                        if (selectedSkills.includes(skill.name)) {
                          setSelectedSkills(selectedSkills.filter((name) => name !== skill.name));
                        } else {
                          setSelectedSkills([...selectedSkills, skill.name]);
                        }
                      }}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-6px'>
                        <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
                        <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 border border-[rgba(var(--primary-6),0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                          Pending
                        </span>
                      </div>
                      {skill.description && (
                        <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
                      )}
                    </div>
                    <Button
                      type='text'
                      size='mini'
                      className='opacity-0 group-hover:opacity-100 transition-opacity !p-4px hover:bg-fill-2 rounded-4px'
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletePendingSkillName(skill.name);
                      }}
                    >
                      <Delete size={16} fill='var(--color-text-3)' />
                    </Button>
                  </div>
                ))}
                {customSkillItems.map((skill) => (
                  <div
                    key={`custom-${skill.name}`}
                    className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px group'
                  >
                    <Checkbox
                      checked={selectedSkills.includes(skill.name)}
                      disabled={!isSkillsEditable}
                      className='mt-2px cursor-pointer'
                      onChange={() => {
                        if (selectedSkills.includes(skill.name)) {
                          setSelectedSkills(selectedSkills.filter((name) => name !== skill.name));
                        } else {
                          setSelectedSkills([...selectedSkills, skill.name]);
                        }
                      }}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-6px'>
                        <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
                        <span className='bg-[rgba(242,156,27,0.08)] text-[rgb(242,156,27)] border border-[rgba(242,156,27,0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                          {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
                        </span>
                      </div>
                      {skill.description && (
                        <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
                      )}
                    </div>
                    <Button
                      type='text'
                      size='mini'
                      className='opacity-0 group-hover:opacity-100 transition-opacity !p-4px hover:bg-fill-2 rounded-4px'
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteCustomSkillName(skill.name);
                      }}
                    >
                      <Delete size={16} fill='var(--color-text-3)' />
                    </Button>
                  </div>
                ))}
                {pendingSkills.length === 0 && customSkillItems.length === 0 && (
                  <div className='text-center text-t-secondary text-12px py-16px'>
                    {t('settings.noCustomSkills', { defaultValue: 'No custom skills added' })}
                  </div>
                )}
              </div>
            </Collapse.Item>

            <Collapse.Item
              header={
                <span className='text-13px font-medium'>
                  {t('settings.builtinSkills', { defaultValue: 'Builtin Skills' })}
                </span>
              }
              name='builtin-skills'
              extra={
                <div className='flex items-center gap-8px'>
                  <span
                    className='inline-block w-8px h-8px rd-50%'
                    style={{ background: builtinStatusDotColor }}
                    aria-hidden='true'
                  />
                  <span className='text-12px text-t-secondary'>
                    {builtinActiveCount > 0
                      ? `${builtinActiveCount}/${builtinSkillItems.length}`
                      : builtinSkillItems.length}
                  </span>
                </div>
              }
            >
              {builtinSkillItems.length > 0 ? (
                <div className='space-y-4px'>
                  {builtinSkillItems.map((skill) => (
                    <div key={skill.name} className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px'>
                      <Checkbox
                        checked={selectedSkills.includes(skill.name)}
                        disabled={!isSkillsEditable}
                        className='mt-2px cursor-pointer'
                        onChange={() => {
                          if (selectedSkills.includes(skill.name)) {
                            setSelectedSkills(selectedSkills.filter((name) => name !== skill.name));
                          } else {
                            setSelectedSkills([...selectedSkills, skill.name]);
                          }
                        }}
                      />
                      <div className='flex-1 min-w-0'>
                        <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
                        {skill.description && (
                          <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center text-t-secondary text-12px py-16px'>
                  {t('settings.noBuiltinSkills', { defaultValue: 'No builtin skills available' })}
                </div>
              )}
            </Collapse.Item>

            {extensionSkillItems.length > 0 && (
              <Collapse.Item
                header={
                  <span className='text-13px font-medium'>
                    {t('settings.extensionSkills', { defaultValue: 'Extension Skills' })}
                  </span>
                }
                name='extension-skills'
                extra={
                  <div className='flex items-center gap-8px'>
                    <span
                      className='inline-block w-8px h-8px rd-50%'
                      style={{ background: extensionStatusDotColor }}
                      aria-hidden='true'
                    />
                    <span className='text-12px text-t-secondary'>
                      {extensionActiveCount > 0
                        ? `${extensionActiveCount}/${extensionSkillItems.length}`
                        : extensionSkillItems.length}
                    </span>
                  </div>
                }
              >
                <div className='space-y-4px'>
                  {extensionSkillItems.map((skill) => (
                    <div key={skill.name} className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px'>
                      <Checkbox
                        checked={selectedSkills.includes(skill.name)}
                        disabled={!isSkillsEditable}
                        className='mt-2px cursor-pointer'
                        onChange={() => {
                          if (selectedSkills.includes(skill.name)) {
                            setSelectedSkills(selectedSkills.filter((name) => name !== skill.name));
                          } else {
                            setSelectedSkills([...selectedSkills, skill.name]);
                          }
                        }}
                      />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-6px'>
                          <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
                          <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 border border-[rgba(var(--primary-6),0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                            {t('settings.extensionSkillsBadge', { defaultValue: 'Extension' })}
                          </span>
                        </div>
                        {skill.description && (
                          <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Collapse.Item>
            )}

            {builtinAutoSkills.length > 0 && (
              <Collapse.Item
                header={
                  <span className='text-13px font-medium'>
                    {t('settings.autoInjectedSkills', { defaultValue: 'Auto-injected Skills' })}
                  </span>
                }
                name='auto-injected-skills'
                extra={
                  <div className='flex items-center gap-8px'>
                    <span
                      className='inline-block w-8px h-8px rd-50%'
                      style={{ background: autoInjectedStatusDotColor }}
                      aria-hidden='true'
                    />
                    <span className='text-12px text-t-secondary'>{`${autoInjectedActiveCount}/${builtinAutoSkills.length}`}</span>
                  </div>
                }
              >
                <div className='space-y-4px'>
                  {builtinAutoSkills.map((skill) => (
                    <div key={skill.name} className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px'>
                      <Checkbox
                        checked={!disabledBuiltinSkills.includes(skill.name)}
                        disabled={!isSkillsEditable}
                        className='mt-2px cursor-pointer'
                        onChange={() => {
                          if (disabledBuiltinSkills.includes(skill.name)) {
                            setDisabledBuiltinSkills(disabledBuiltinSkills.filter((name) => name !== skill.name));
                          } else {
                            setDisabledBuiltinSkills([...disabledBuiltinSkills, skill.name]);
                          }
                        }}
                      />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-6px'>
                          <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
                          <span className='bg-[rgba(var(--success-6),0.08)] text-[rgb(var(--success-6))] border border-[rgba(var(--success-6),0.2)] text-10px px-4px py-1px rd-4px font-medium uppercase'>
                            {t('settings.autoInjectedSkillsBadge', { defaultValue: 'Auto' })}
                          </span>
                        </div>
                        {skill.description && (
                          <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Collapse.Item>
            )}
          </Collapse>
        </div>
      )}

      {activeAssistant && isExtensionAssistant(activeAssistant) && (
        <div className='text-12px text-t-tertiary'>
          {t('settings.assistantExtensionReadonlyTip', {
            defaultValue: 'Extension assistants are read-only in assistant settings.',
          })}
        </div>
      )}
    </div>
  );
};

export default AssistantEditorSections;
