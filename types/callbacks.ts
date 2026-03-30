// ── Shared callback type signatures ──────────────────────────────────────
// Imported by every domain hook (useOrderLogic, useUserLogic,
// useVoucherLogic) so they no longer need `any` for injected functions.

import { NotificationAction } from '../types';

export type LogEventFn = (
  action: string,
  details: string,
  targetEntityId?: string,
  targetEntityType?: string
) => void;

export type NotifyUserFn = (
  userId: string,
  message: string,
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR',
  action?: NotificationAction,
  targetEntityId?: string,
  targetEntityType?: string
) => void;

export type AddToastFn = (
  title: string,
  message: string,
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
) => void;
