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

function isLocalActivationMessage(message?: string | null): boolean {
  if (!message) {
    return false;
  }
  return /activating managed/i.test(message);
}

function isBundledResourceFailure(message?: string | null): boolean {
  if (!message) {
    return false;
  }
  return /bundled|managed-resources|installation incomplete|local .* failed validation|failed validation under .*resources/i.test(
    message
  );
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
        defaultValue: 'Preparing {{resource}}.',
      });
      const progress = extractDownloadProgress(status.message);
      return progress ? appendProgressSuffix(base, progress) : base;
    }
    case 'extracting':
      if (isLocalActivationMessage(status.message)) {
        return t('settings.runtimeStatus.extracting', {
          resource,
          defaultValue: 'Preparing {{resource}}.',
        });
      }
      return t('settings.runtimeStatus.extracting', {
        resource,
        defaultValue: 'Preparing {{resource}}.',
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
            defaultValue:
              'Preparing {{resource}} timed out. Restart the app and try again. If it continues, reinstall the app or download a fresh package.',
          });
        case 'download_failed':
          if (isBundledResourceFailure(status.message)) {
            return t('settings.runtimeStatus.failedBundled', {
              resource,
              defaultValue:
                'Preparing {{resource}} failed because the bundled component files are invalid. Reinstall the app or download a fresh package and try again.',
            });
          }
          return t('settings.runtimeStatus.failedDownload', {
            resource,
            defaultValue:
              'Preparing {{resource}} failed. Restart the app and try again. If it continues, reinstall the app or download a fresh package.',
          });
        case 'http_status':
          if (isBundledResourceFailure(status.message)) {
            return t('settings.runtimeStatus.failedBundled', {
              resource,
              defaultValue:
                'Preparing {{resource}} failed because the bundled component files are invalid. Reinstall the app or download a fresh package and try again.',
            });
          }
          return t('settings.runtimeStatus.failedUnknown', {
            resource,
            defaultValue:
              'Preparing {{resource}} failed. Restart the app and try again. If it continues, reinstall the app or download a fresh package.',
          });
        case 'checksum_mismatch':
          return t('settings.runtimeStatus.failedChecksum', {
            resource,
            defaultValue:
              'Verifying {{resource}} failed because the component files may be corrupted. Reinstall the app or download a fresh package and try again.',
          });
        case 'validation_failed':
          if (isBundledResourceFailure(status.message)) {
            return t('settings.runtimeStatus.failedBundled', {
              resource,
              defaultValue:
                'Preparing {{resource}} failed because the bundled component files are invalid. Reinstall the app or download a fresh package and try again.',
            });
          }
          return t('settings.runtimeStatus.failedValidation', {
            resource,
            defaultValue:
              'Validating {{resource}} failed. Restart the app and try again. If it continues, reinstall the app or download a fresh package.',
          });
        case 'unsupported_platform':
          return t('settings.runtimeStatus.failedUnsupported', {
            resource,
            defaultValue: '{{resource}} is not supported on this platform.',
          });
        default:
          if (isBundledResourceFailure(status.message)) {
            return t('settings.runtimeStatus.failedBundled', {
              resource,
              defaultValue:
                'Preparing {{resource}} failed because the bundled component files are invalid. Reinstall the app or download a fresh package and try again.',
            });
          }
          return t('settings.runtimeStatus.failedUnknown', {
            resource,
            defaultValue:
              'Preparing {{resource}} failed. Restart the app and try again. If it continues, reinstall the app or download a fresh package.',
          });
      }
  }
}
