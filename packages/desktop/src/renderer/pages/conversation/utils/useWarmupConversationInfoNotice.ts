import { Message } from '@arco-design/web-react';
import { useEffect, useRef } from 'react';

import { useWarmupConversationStatus } from './useWarmupConversationStatus';

export function useWarmupConversationInfoNotice(
  conversation_id: string | undefined,
  message: string,
  hintDelayMs = 1200
) {
  const { showPreparingHint, status } = useWarmupConversationStatus(conversation_id, hintDelayMs);
  const notifiedAttemptRef = useRef(0);

  useEffect(() => {
    if (!showPreparingHint || status.phase !== 'preparing') {
      return;
    }
    if (status.attempt <= notifiedAttemptRef.current) {
      return;
    }

    notifiedAttemptRef.current = status.attempt;
    Message.info(message);
  }, [message, showPreparingHint, status.attempt, status.phase]);
}
