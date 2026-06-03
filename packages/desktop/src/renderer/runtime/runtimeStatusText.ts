import type { TFunction } from 'i18next';

import type { IRuntimeStatusEvent, IRuntimeStatusScope } from '@/common/adapter/ipcBridge';

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

export function formatRuntimeStatusText(t: TFunction, status: IRuntimeStatusEvent): string {
  switch (status.phase) {
    case 'waiting_for_lock':
      return t('settings.runtimeStatus.waitingForLock', {
        defaultValue: 'Waiting for another task to finish preparing the runtime.',
      });
    case 'downloading':
      return t('settings.runtimeStatus.downloading', {
        defaultValue: 'Downloading the managed Node runtime.',
      });
    case 'extracting':
      return t('settings.runtimeStatus.extracting', {
        defaultValue: 'Extracting the managed Node runtime.',
      });
    case 'validating':
      return t('settings.runtimeStatus.validating', {
        defaultValue: 'Validating the managed Node runtime.',
      });
    case 'ready':
      return t('settings.runtimeStatus.ready', {
        defaultValue: 'The managed Node runtime is ready.',
      });
    case 'failed':
      switch (status.failure_kind) {
        case 'timeout':
          return t('settings.runtimeStatus.failedTimeout', {
            defaultValue: 'Preparing the managed Node runtime timed out. Try again.',
          });
        case 'download_failed':
          return t('settings.runtimeStatus.failedDownload', {
            defaultValue: 'Downloading the managed Node runtime failed. Check your network and try again.',
          });
        case 'http_status':
          return t('settings.runtimeStatus.failedHttp', {
            status: status.status_code ?? 'unknown',
            defaultValue: 'Downloading the managed Node runtime failed (HTTP {{status}}).',
          });
        case 'validation_failed':
          return t('settings.runtimeStatus.failedValidation', {
            defaultValue: 'Validating the managed Node runtime failed. Try again.',
          });
        case 'unsupported_platform':
          return t('settings.runtimeStatus.failedUnsupported', {
            defaultValue: 'Managed Node runtime is not supported on this platform.',
          });
        default:
          return t('settings.runtimeStatus.failedUnknown', {
            defaultValue: 'Preparing the managed Node runtime failed. Try again.',
          });
      }
  }
}
