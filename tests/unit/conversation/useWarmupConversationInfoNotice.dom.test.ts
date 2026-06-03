import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warmupInvoke, messageInfo } = vi.hoisted(() => ({
  warmupInvoke: vi.fn(),
  messageInfo: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      warmup: {
        invoke: warmupInvoke,
      },
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      ...actual.Message,
      info: messageInfo,
    },
  };
});

import {
  resetWarmupConversationStateForTests,
  warmupConversation,
} from '@/renderer/pages/conversation/utils/warmupConversation';
import { useWarmupConversationInfoNotice } from '@/renderer/pages/conversation/utils/useWarmupConversationInfoNotice';

describe('useWarmupConversationInfoNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    warmupInvoke.mockReset();
    messageInfo.mockReset();
    resetWarmupConversationStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a transient info message once when the first warmup stays pending past the threshold', async () => {
    let resolveWarmup: (() => void) | undefined;
    warmupInvoke.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWarmup = resolve;
      })
    );

    renderHook(() => useWarmupConversationInfoNotice('conv-1', 'Preparing runtime', 1_000));

    await act(async () => {
      void warmupConversation('conv-1');
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(messageInfo).toHaveBeenCalledTimes(1);
    expect(messageInfo).toHaveBeenCalledWith('Preparing runtime');

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(messageInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveWarmup?.();
      await Promise.resolve();
    });
  });
});
