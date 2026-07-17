import { Role } from '@/types/enums';

// AppId przygotowany na kolejne etapy migracji (E2: agencja+dokumenty, E3: komunikacja, E4: ksiegowosc).
// W E1 zarejestrowana jest wyłącznie appka 'benefity'. CRM celowo nie istnieje (osobny CRM Stratton Prime).
export type AppId = 'benefity' | 'agencja' | 'dokumenty' | 'komunikacja' | 'ksiegowosc';

export interface AppDef {
  id: AppId;
  name: string;
  icon: string;
  route: string;
  defaultRoles: Role[];
}

export const APPS: readonly AppDef[] = [
  {
    id: 'benefity',
    name: 'Benefity',
    icon: 'gift',
    route: '/app/benefity',
    defaultRoles: [Role.EMPLOYEE, Role.HR, Role.SUPERADMIN],
  },
  {
    id: 'agencja',
    name: 'Agencja Pracy',
    icon: 'hard-hat',
    route: '/app/agencja',
    defaultRoles: [Role.COORDINATOR, Role.PAYROLL, Role.TEMP_WORKER, Role.SUPERADMIN],
  },
] as const;

export const APP_IDS = APPS.map(a => a.id) as AppId[];

export const isAppId = (x: string): x is AppId =>
  (APP_IDS as string[]).includes(x);
