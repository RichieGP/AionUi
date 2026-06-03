import { ipcBridge } from '@/common';
import { useSyncExternalStore } from 'react';

import type { IRuntimeStatusEvent, IRuntimeStatusScope, RuntimeStatusPhase } from '@/common/adapter/ipcBridge';

export interface RuntimeSnapshot extends IRuntimeStatusEvent {
  observedAt: number;
}

type RuntimeRetryHandler = () => void | Promise<void>;

const READY_DISMISS_DELAY_MS = 1200;

const listeners = new Set<() => void>();
const snapshots = new Map<string, RuntimeSnapshot>();
const retryHandlers = new Map<string, RuntimeRetryHandler>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
let initialized = false;

function scopeKey(scope: IRuntimeStatusScope): string {
  return `${scope.kind}:${scope.id}`;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function clearCleanupTimer(key: string) {
  const timer = cleanupTimers.get(key);
  if (!timer) {
    return;
  }
  clearTimeout(timer);
  cleanupTimers.delete(key);
}

function removeScope(scope: IRuntimeStatusScope, clearRetry = false) {
  const key = scopeKey(scope);
  clearCleanupTimer(key);
  const removed = snapshots.delete(key);
  if (clearRetry) {
    retryHandlers.delete(key);
  }
  if (removed) {
    emitChange();
  }
}

function ensureInitialized() {
  if (initialized) {
    return;
  }
  initialized = true;

  ipcBridge.runtime.statusChanged.on((event) => {
    const key = scopeKey(event.scope);
    clearCleanupTimer(key);
    snapshots.set(key, {
      ...event,
      observedAt: Date.now(),
    });
    emitChange();

    if (event.phase === 'ready') {
      const timer = setTimeout(() => {
        removeScope(event.scope, true);
      }, READY_DISMISS_DELAY_MS);
      cleanupTimers.set(key, timer);
    }
  });
}

function phasePriority(phase: RuntimeStatusPhase): number {
  switch (phase) {
    case 'failed':
      return 3;
    case 'waiting_for_lock':
    case 'downloading':
    case 'extracting':
    case 'validating':
      return 2;
    case 'ready':
      return 1;
  }
}

export function registerRuntimeRetry(scope: IRuntimeStatusScope, handler: RuntimeRetryHandler): () => void {
  ensureInitialized();
  const key = scopeKey(scope);
  retryHandlers.set(key, handler);
  return () => {
    if (retryHandlers.get(key) === handler) {
      retryHandlers.delete(key);
    }
  };
}

export function retryRuntimeStatus(scope: IRuntimeStatusScope): Promise<void> | null {
  ensureInitialized();
  const handler = retryHandlers.get(scopeKey(scope));
  if (!handler) {
    return null;
  }
  return Promise.resolve(handler());
}

export function dismissRuntimeStatus(scope: IRuntimeStatusScope) {
  ensureInitialized();
  removeScope(scope, true);
}

export function useGlobalRuntimeStatus(): RuntimeSnapshot | null {
  return useSyncExternalStore(
    (listener) => {
      ensureInitialized();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    (): RuntimeSnapshot | null => {
      ensureInitialized();
      const values = [...snapshots.values()];
      values.sort((a, b) => phasePriority(b.phase) - phasePriority(a.phase) || b.observedAt - a.observedAt);
      return values[0] ?? null;
    },
    (): RuntimeSnapshot | null => null
  );
}

export function isRuntimeActivePhase(phase: RuntimeStatusPhase): boolean {
  return phase === 'waiting_for_lock' || phase === 'downloading' || phase === 'extracting' || phase === 'validating';
}
