import { NotificationActionType, NotificationPriority, NotificationTarget, NotificationTrigger } from './enums';
import { EntityType } from './core';

export interface NotificationAction {
  type: NotificationActionType;
  targetId: string;
  label: string;
  variant: 'primary' | 'danger' | 'neutral';
  completed?: boolean;
  completedLabel?: string;
}

export interface NotificationConfig {
  id: string;
  target: NotificationTarget;
  trigger: NotificationTrigger;
  daysOffset?: number;
  messageTemplate: string;
  isEnabled: boolean;
}

export interface NotificationChannelPreference {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationPreferenceItem {
  id: string;
  trigger: NotificationTrigger;
  label: string;
  channels: NotificationChannelPreference;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  priority?: NotificationPriority;
  read: boolean;
  date: string;
  action?: NotificationAction;
  targetEntityId?: string;
  targetEntityType?: EntityType;
}
