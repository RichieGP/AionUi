import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  getWarmupConversationStatus,
  subscribeWarmupConversation,
  type WarmupConversationStatus,
} from './warmupConversation';

const IDLE_STATUS: WarmupConversationStatus = {
  phase: 'idle',
  attempt: 0,
};

export function useWarmupConversationStatus(conversation_id?: string, hintDelayMs = 1200) {
  const status = useSyncExternalStore(
    (listener) => {
      if (!conversation_id) {
        return () => undefined;
      }
      return subscribeWarmupConversation(conversation_id, listener);
    },
    () => getWarmupConversationStatus(conversation_id),
    () => IDLE_STATUS
  );
  const [showPreparingHint, setShowPreparingHint] = useState(false);

  useEffect(() => {
    if (status.phase !== 'preparing' || status.attempt !== 1) {
      setShowPreparingHint(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowPreparingHint(true);
    }, hintDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hintDelayMs, status.attempt, status.phase]);

  return {
    status,
    isPreparing: status.phase === 'preparing',
    showPreparingHint,
  };
}
