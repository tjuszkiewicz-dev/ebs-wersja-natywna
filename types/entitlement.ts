import type { AppId } from '@/lib/apps/registry';

export type Entitlement = { app_id: AppId; effect: 'grant' | 'revoke' };
