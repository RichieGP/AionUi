import { ConfigStorage } from '@/common/config/storage';
import AgentBadge from '@/renderer/components/agent/AgentBadge';
import type { PresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import FlexFullContainer from '@/renderer/components/layout/FlexFullContainer';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useResizableSplit } from '@/renderer/hooks/ui/useResizableSplit';
import ConversationTabs from '@/renderer/pages/conversation/components/ConversationTabs';
import ChatTitleEditor from '@/renderer/pages/conversation/components/ChatTitleEditor';
import ConversationTitleMinimap from '@/renderer/pages/conversation/components/ConversationTitleMinimap';
import MobileWorkspaceOverlay from './MobileWorkspaceOverlay';
import WorkspacePanelHeader, { DesktopWorkspaceToggle } from './WorkspacePanelHeader';
import { useConversationTabs } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';
import { useContainerWidth } from '@/renderer/pages/conversation/hooks/useContainerWidth';
import { useLayoutConstraints } from '@/renderer/pages/conversation/hooks/useLayoutConstraints';
import { usePreviewAutoCollapse } from '@/renderer/pages/conversation/hooks/usePreviewAutoCollapse';
import { useTitleRename } from '@/renderer/pages/conversation/hooks/useTitleRename';
import { useWorkspaceCollapse } from '@/renderer/pages/conversation/hooks/useWorkspaceCollapse';
import { PreviewPanel, usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { dispatchWorkspaceToggleEvent } from '@/renderer/utils/workspace/workspaceEvents';
import { ACP_BACKENDS_ALL } from '@/common/types/acpTypes';
import classNames from 'classnames';
import { isMacEnvironment, isWindowsEnvironment } from '@/renderer/pages/conversation/utils/detectPlatform';
import { isElectronDesktop } from '@/renderer/utils/platform';
import {
  MIN_WORKSPACE_RATIO,
  WORKSPACE_HEADER_HEIGHT,
  calcLayoutMetrics,
} from '@/renderer/pages/conversation/utils/layoutCalc';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import { ExpandLeft, ExpandRight } from '@icon-park/react';
import React from 'react';
import useSWR from 'swr';
import './chat-layout.css';

// headerExtra allows injecting custom actions (e.g., model picker) into the header's right area
const ChatLayout: React.FC<{
  children: React.ReactNode;
  title?: React.ReactNode;
  sider: React.ReactNode;
  siderTitle?: React.ReactNode;
  backend?: string;
  /** Preset assistant info — when provided, badge shows assistant identity instead of backend */
  presetAssistant?: PresetAssistantInfo & { id?: string };
  /** Fallback agent name (used when no presetAssistant, e.g. from conversation.extra.agentName) */
  agentName?: string;
  headerExtra?: React.ReactNode;
  headerLeft?: React.ReactNode;
  workspaceEnabled?: boolean;
  /** Conversation ID for mode switching */
  conversationId?: string;
  /** Custom tabs slot; when provided, replaces the default ConversationTabs */
  tabsSlot?: React.ReactNode;
  /** Workspace path for opening in external tools */
  workspacePath?: string;
  /** Custom rename handler; when provided, replaces the default conversation.update rename flow */
  onRenameTitle?: (newName: string) => Promise<boolean>;
}> = (props) => {
  const { conversationId, workspacePath } = props;
  const { backend, presetAssistant, agentName, workspaceEnabled = true } = props;
  const layout = useLayoutContext();
  const isMacRuntime = isMacEnvironment();
  const isWindowsRuntime = isWindowsEnvironment();
  const isDesktop = !layout?.isMobile;
  const isMobile = Boolean(layout?.isMobile);

  // Preview panel state
  const { isOpen: isPreviewOpen } = usePreviewContext();

  // --- Hook A: workspace collapse ---
  const { rightSiderCollapsed, setRightSiderCollapsed } = useWorkspaceCollapse({
    workspaceEnabled,
    isMobile,
    conversationId,
  });

  // --- Hook B: container width ---
  const { containerRef, containerWidth } = useContainerWidth();

  // --- Hook C: title rename ---
  const { openTabs, updateTabName } = useConversationTabs();
  const hasTabs = openTabs.length > 0;

  const { editingTitle, setEditingTitle, titleDraft, setTitleDraft, renameLoading, canRenameTitle, submitTitleRename } =
    useTitleRename({
      title: props.title,
      conversationId,
      updateTabName,
      onRename: props.onRenameTitle,
    });

  // Fetch custom agents config as fallback when agentName is not provided
  const needCustomFallback = backend === 'custom' && !presetAssistant && !agentName;
  const { data: customAgents } = useSWR(needCustomFallback ? 'acp.customAgents' : null, () =>
    ConfigStorage.get('acp.customAgents')
  );

  // Compute display name with fallback chain
  const displayName =
    presetAssistant?.name ||
    agentName ||
    (backend === 'custom' && customAgents?.[0]?.name) ||
    ACP_BACKENDS_ALL[backend as keyof typeof ACP_BACKENDS_ALL]?.name ||
    backend;

  const {
    splitRatio: workspaceSplitRatio,
    setSplitRatio: setWorkspaceSplitRatio,
    createDragHandle: createWorkspaceDragHandle,
  } = useResizableSplit({
    defaultWidth: 20,
    minWidth: MIN_WORKSPACE_RATIO,
    maxWidth: 40,
    storageKey: 'chat-workspace-split-ratio',
  });

  // Pre-hook metrics: compute dynamic min/max for the chat-preview split hook
  const { dynamicChatMinRatio, dynamicChatMaxRatio } = calcLayoutMetrics({
    containerWidth,
    workspaceSplitRatio,
    chatSplitRatio: 60, // placeholder; only dynamicChatMinRatio/dynamicChatMaxRatio are used here
    workspaceEnabled,
    isDesktop,
    isPreviewOpen,
    rightSiderCollapsed,
    isMobile,
  });

  const {
    splitRatio: chatSplitRatio,
    setSplitRatio: setChatSplitRatio,
    createDragHandle: createPreviewDragHandle,
  } = useResizableSplit({
    defaultWidth: 60,
    minWidth: dynamicChatMinRatio,
    maxWidth: dynamicChatMaxRatio,
    storageKey: 'chat-preview-split-ratio',
  });

  // Full metrics with real chatSplitRatio
  const { chatFlex, workspaceFlex, workspaceWidthPx, titleAreaMaxWidth, mobileWorkspaceHandleRight } =
    calcLayoutMetrics({
      containerWidth,
      workspaceSplitRatio,
      chatSplitRatio,
      workspaceEnabled,
      isDesktop,
      isPreviewOpen,
      rightSiderCollapsed,
      isMobile,
    });

  // --- Hook D: preview auto-collapse ---
  usePreviewAutoCollapse({
    isPreviewOpen,
    isDesktop,
    workspaceEnabled,
    rightSiderCollapsed,
    setRightSiderCollapsed,
    siderCollapsed: layout?.siderCollapsed,
    setSiderCollapsed: layout?.setSiderCollapsed,
  });

  // --- Hook E: layout constraints ---
  useLayoutConstraints({
    containerWidth,
    workspaceEnabled,
    isDesktop,
    isPreviewOpen,
    rightSiderCollapsed,
    setRightSiderCollapsed,
    workspaceSplitRatio,
    setWorkspaceSplitRatio,
    chatSplitRatio,
    setChatSplitRatio,
    dynamicChatMinRatio,
    dynamicChatMaxRatio,
  });

  const headerPaddingLeft = isMacRuntime && !isMobile && layout?.siderCollapsed ? '120px' : undefined;

  const headerBlock = (
    <>
      <ArcoLayout.Header
        className={classNames(
          'flex items-center justify-between gap-8px !bg-1 chat-layout-header chat-layout-header--glass overflow-hidden',
          layout?.isMobile
            ? 'min-h-44px px-16px pt-8px pb-10px chat-layout-header--mobile-unified'
            : 'pl-8px pr-20px py-16px',
          isDesktop && isElectronDesktop() && 'chat-layout-header--draggable'
        )}
        style={headerPaddingLeft ? { paddingLeft: headerPaddingLeft } : undefined}
      >
        <div className='shrink-0 flex items-center gap-8px'>{props.headerLeft}</div>
        <FlexFullContainer className='h-full min-w-0' containerClassName='flex items-center gap-16px'>
          {!layout?.isMobile && !hasTabs && (
            <ChatTitleEditor
              editingTitle={editingTitle}
              titleDraft={titleDraft}
              setTitleDraft={setTitleDraft}
              setEditingTitle={setEditingTitle}
              renameLoading={renameLoading}
              canRenameTitle={canRenameTitle}
              submitTitleRename={submitTitleRename}
              titleAreaMaxWidth={titleAreaMaxWidth}
              title={props.title}
              conversationId={conversationId}
            />
          )}
          {(hasTabs || layout?.isMobile) && <ConversationTitleMinimap conversationId={conversationId} hideTrigger />}
        </FlexFullContainer>
        <div className='flex items-center gap-9px shrink-0'>
          {props.headerExtra}
          {(backend || presetAssistant) && (
            <AgentBadge
              backend={backend}
              agentName={displayName}
              agentLogo={presetAssistant?.logo}
              agentLogoIsEmoji={presetAssistant?.isEmoji}
              assistantId={presetAssistant?.id}
            />
          )}
          {isDesktop && workspaceEnabled && (
            <button
              type='button'
              className='chat-layout-header__workspace-toggle'
              aria-label='Toggle workspace'
              onClick={() => dispatchWorkspaceToggleEvent()}
            >
              {rightSiderCollapsed ? <ExpandRight size={16} /> : <ExpandLeft size={16} />}
            </button>
          )}
        </div>
      </ArcoLayout.Header>
      {props.tabsSlot !== undefined ? props.tabsSlot : <ConversationTabs />}
    </>
  );

  // 桌面端：header 横跨整个宽度，下面是 chat + workspace 并排
  // 移动端：保留原有结构（header 只在主内容区上方）
  if (isDesktop && !isPreviewOpen) {
    return (
      <ArcoLayout className='size-full color-black flex flex-col'>
        {/* Header 横跨整个屏幕宽度 */}
        <div className='shrink-0 !bg-1'>{headerBlock}</div>
        {/* 下方：左侧主内容 + 右侧工作空间 */}
        <div ref={containerRef} className='flex flex-1 relative w-full overflow-hidden min-h-0'>
          <div
            className='flex flex-col relative'
            style={{
              flexGrow: chatFlex,
              flexShrink: 0,
              flexBasis: 0,
              minWidth: '240px',
            }}
          >
            <ArcoLayout.Content className='flex flex-col flex-1 bg-1 overflow-hidden'>
              {props.children}
            </ArcoLayout.Content>
          </div>
          {workspaceEnabled && (
            <div
              className='relative chat-layout-right-sider-outer'
              style={{
                flexGrow: workspaceFlex,
                flexShrink: 0,
                flexBasis: rightSiderCollapsed ? '0px' : 0,
                width: rightSiderCollapsed ? '0px' : undefined,
                minWidth: rightSiderCollapsed ? '0px' : '220px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-1)',
                padding: rightSiderCollapsed ? '0' : '8px 8px 8px 0',
              }}
            >
              <div
                className='chat-layout-right-sider h-full flex flex-col'
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-2, #e5e6eb)',
                  backgroundColor: 'var(--bg-1)',
                  overflow: 'hidden',
                }}
              >
                {!rightSiderCollapsed &&
                  createWorkspaceDragHandle({ className: 'absolute left-0 top-0 bottom-0', style: {}, reverse: true })}
                <ArcoLayout.Content className='h-full !bg-transparent'>{props.sider}</ArcoLayout.Content>
              </div>
            </div>
          )}
        </div>
      </ArcoLayout>
    );
  }

  return (
    <ArcoLayout
      className='size-full color-black '
      style={{
        // fontFamily: `cursive,"anthropicSans","anthropicSans Fallback",system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif`,
      }}
    >
      <div ref={containerRef} className='flex flex-1 relative w-full overflow-hidden'>
        {isPreviewOpen && isDesktop ? (
          /* Desktop with preview: header spans chat+preview, preview sits below header */
          <>
            <div className='flex flex-col flex-1 min-w-0'>
              <div className='shrink-0 !bg-1'>{headerBlock}</div>
              <div className='flex flex-1 min-h-0 relative'>
                <div
                  className='flex flex-col relative'
                  style={{
                    flexGrow: 0,
                    flexShrink: 0,
                    flexBasis: `${chatFlex}%`,
                    minWidth: '240px',
                  }}
                >
                  <ArcoLayout.Content className='flex flex-col flex-1 bg-1 overflow-hidden'>
                    {props.children}
                  </ArcoLayout.Content>
                </div>
                <div
                  className='preview-panel flex flex-col relative overflow-visible rounded-[15px] mb-[12px] mr-[12px] ml-[8px]'
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    border: '1px solid var(--bg-3)',
                    minWidth: '260px',
                    boxSizing: 'border-box',
                  }}
                >
                  {createPreviewDragHandle({
                    className: 'absolute top-0 bottom-0 z-30',
                    style: { width: '20px', left: '-20px' },
                    linePlacement: 'end',
                    lineClassName: 'opacity-30 group-hover:opacity-100 group-active:opacity-100',
                    lineStyle: { width: '2px' },
                  })}
                  <div className='h-full w-full overflow-hidden rounded-[15px]'>
                    <PreviewPanel />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Mobile */
          <>
            <div
              className='flex flex-col relative'
              style={{
                flexGrow: chatFlex,
                flexShrink: 0,
                flexBasis: 0,
                display: isPreviewOpen && layout?.isMobile ? 'none' : 'flex',
                minWidth: isDesktop ? '240px' : '100%',
              }}
            >
              <ArcoLayout.Content
                className='flex flex-col h-full'
                onClick={() => {
                  if (window.innerWidth < 768 && !rightSiderCollapsed) setRightSiderCollapsed(true);
                }}
              >
                {headerBlock}
                <ArcoLayout.Content className='flex flex-col flex-1 bg-1 overflow-hidden'>
                  {props.children}
                </ArcoLayout.Content>
              </ArcoLayout.Content>
            </div>
            {isPreviewOpen && (
              <div
                className={classNames(
                  'preview-panel flex flex-col relative overflow-visible rounded-[15px]',
                  'm-[8px]'
                )}
                style={{
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                  border: '1px solid var(--bg-3)',
                  width: 'calc(100% - 16px)',
                  maxWidth: 'calc(100% - 16px)',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              >
                <div className='h-full w-full overflow-hidden rounded-[15px]'>
                  <PreviewPanel />
                </div>
              </div>
            )}
          </>
        )}
        {workspaceEnabled && !layout?.isMobile && (
          <div
            className='relative chat-layout-right-sider-outer'
            style={{
              flexGrow: isPreviewOpen ? 0 : workspaceFlex,
              flexShrink: 0,
              flexBasis: rightSiderCollapsed ? '0px' : isPreviewOpen ? `${Math.round(workspaceWidthPx)}px` : 0,
              width: rightSiderCollapsed ? '0px' : isPreviewOpen ? `${Math.round(workspaceWidthPx)}px` : undefined,
              minWidth: rightSiderCollapsed ? '0px' : '220px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-2)',
              padding: rightSiderCollapsed ? '0' : '57px 8px 8px 0',
            }}
          >
            <div
              className='chat-layout-right-sider h-full flex flex-col'
              style={{
                borderRadius: '12px',
                border: '1px solid var(--color-border-2, #e5e6eb)',
                backgroundColor: 'var(--bg-1)',
                overflow: 'hidden',
              }}
            >
              {isDesktop &&
                !rightSiderCollapsed &&
                createWorkspaceDragHandle({ className: 'absolute left-0 top-0 bottom-0', style: {}, reverse: true })}
              <ArcoLayout.Content className='h-full !bg-transparent'>{props.sider}</ArcoLayout.Content>
            </div>
          </div>
        )}

        {/* Mobile workspace overlay: backdrop + fixed panel + floating collapse handle */}
        {workspaceEnabled && layout?.isMobile && (
          <MobileWorkspaceOverlay
            rightSiderCollapsed={rightSiderCollapsed}
            setRightSiderCollapsed={setRightSiderCollapsed}
            workspaceWidthPx={workspaceWidthPx}
            mobileWorkspaceHandleRight={mobileWorkspaceHandleRight}
            siderTitle={props.siderTitle}
            sider={props.sider}
            workspacePath={workspacePath}
          />
        )}
      </div>
    </ArcoLayout>
  );
};

export default ChatLayout;
