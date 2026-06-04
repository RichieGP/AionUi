import type { TFunction } from 'i18next';

import type { IRuntimeStatusEvent, IRuntimeStatusScope } from '@/common/adapter/ipcBridge';

function extractDownloadProgress(message?: string | null): string | null {
  if (!message) {
    return null;
  }

  const match = message.match(/\((\d+)MB(?:\s*\/\s*(\d+)MB)?\)/i);
  if (!match) {
    return null;
  }

  const downloaded = `${match[1]}MB`;
  const total = match[2] ? `${match[2]}MB` : null;
  return total ? `${downloaded} / ${total}` : downloaded;
}

function appendProgressSuffix(text: string, progress: string): string {
  const trimmed = text.trim().replace(/[。.]$/, '');
  return `${trimmed} (${progress})`;
}

export function formatRuntimeScopeLabel(t: TFunction, scope: IRuntimeStatusScope): string {
  switch (scope.kind) {
    case 'conversation':
      return t('settings.runtimeScope.conversation', { defaultValue: 'Conversation' });
    case 'mcp':
      return t('settings.runtimeScope.mcp', { defaultValue: 'MCP' });
    case 'custom_agent':
      return t('settings.runtimeScope.customAgent', { defaultValue: 'Custom Agent' });
  }
}


function formatRuntimeResourceLabel(t: TFunction, status: IRuntimeStatusEvent): string {
  if (status.resource === 'acp_tool') {
    if (status.resource_id === 'codex-acp') {
      return t('settings.runtimeResource.codexAcp');
    }
    if (status.resource_id === 'claude-agent-acp') {
      return t('settings.runtimeResource.claudeAgentAcp');
    }
    return t('settings.runtimeResource.acpTool');
  }
  return t('settings.runtimeResource.node');
}

export function formatRuntimeStatusText(t: TFunction, status: IRuntimeStatusEvent): string {
  const resource = formatRuntimeResourceLabel(t, status);

  switch (status.phase) {
    case 'waiting_for_lock': {
      return t('settings.runtimeStatus.waitingForLock', {
        resource,
        defaultValue: 'Waiting for another task to finish preparing {{resource}}.',
      });
    }
    case 'downloading': {
      const base = t('settings.runtimeStatus.downloading', {
        resource,
        defaultValue: 'Downloading {{resource}}.',
      });
      const progress = extractDownloadProgress(status.message);
      return progress ? appendProgressSuffix(base, progress) : base;
    }
    case 'extracting':
      return t('settings.runtimeStatus.extracting', {
        resource,
        defaultValue: 'Extracting {{resource}}.',
      });
    case 'validating':
      return t('settings.runtimeStatus.validating', {
        resource,
        defaultValue: 'Validating {{resource}}.',
      });
    case 'ready':
      return t('settings.runtimeStatus.ready', {
        resource,
        defaultValue: '{{resource}} is ready.',
      });
    case 'failed':
      switch (status.failure_kind) {
        case 'timeout':
          return t('settings.runtimeStatus.failedTimeout', {
            resource,
            defaultValue: 'Preparing {{resource}} timed out. Try again.',
          });
        case 'download_failed':
          return t('settings.runtimeStatus.failedDownload', {
            resource,
            defaultValue: 'Downloading {{resource}} failed. Check your network and try again.',
          });
        case 'http_status':
          return t('settings.runtimeStatus.failedHttp', {
            resource,
            status: status.status_code ?? 'unknown',
            defaultValue: 'Downloading {{resource}} failed (HTTP {{status}}).',
          });
        case 'checksum_mismatch':
          return t('settings.runtimeStatus.failedChecksum', {
            resource,
            defaultValue: 'Verifying {{resource}} failed because the downloaded file was corrupted. Try again.',
          });
        case 'validation_failed':
          return t('settings.runtimeStatus.failedValidation', {
            resource,
            defaultValue: 'Validating {{resource}} failed. Try again.',
          });
        case 'unsupported_platform':
          return t('settings.runtimeStatus.failedUnsupported', {
            resource,
            defaultValue: '{{resource}} is not supported on this platform.',
          });
        default:
          return t('settings.runtimeStatus.failedUnknown', {
            resource,
            defaultValue: 'Preparing {{resource}} failed. Try again.',
          });
      }
  }
}
