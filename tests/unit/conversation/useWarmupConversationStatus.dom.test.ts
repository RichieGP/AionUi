import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warmupInvoke } = vi.hoisted(() => ({
  warmupInvoke: vi.fn(),
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

import {
  resetWarmupConversationStateForTests,
  warmupConversation,
} from '@/renderer/pages/conversation/utils/warmupConversation';
import { useWarmupConversationStatus } from '@/renderer/pages/conversation/utils/useWarmupConversationStatus';

describe('useWarmupConversationStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    warmupInvoke.mockReset();
    resetWarmupConversationStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the managed-runtime hint only after the first warmup stays pending past the threshold', async () => {
    let resolveWarmup: (() => void) | undefined;
    warmupInvoke.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWarmup = resolve;
      })
    );

    const { result } = renderHook(() => useWarmupConversationStatus('conv-1', 1_000));

    await act(async () => {
      void warmupConversation('conv-1');
      await Promise.resolve();
    });

    expect(result.current.status.phase).toBe('preparing');
    expect(result.current.showPreparingHint).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.showPreparingHint).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.showPreparingHint).toBe(true);

    await act(async () => {
      resolveWarmup?.();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status.phase).toBe('ready');
    expect(result.current.showPreparingHint).toBe(false);
  });

  it('records warmup failures and clears the hint again', async () => {
    warmupInvoke.mockRejectedValueOnce(new Error('warmup failed'));

    const { result } = renderHook(() => useWarmupConversationStatus('conv-2', 10));

    await act(async () => {
      await expect(warmupConversation('conv-2')).rejects.toThrow('warmup failed');
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status.phase).toBe('error');
    expect(result.current.status.errorMessage).toContain('warmup failed');
    expect(result.current.showPreparingHint).toBe(false);
  });
});
