
import { useState, useCallback } from 'react';
import { Notification, NotificationAction, NotificationConfig } from '../../types';
import { INITIAL_NOTIFICATIONS, INITIAL_NOTIFICATION_CONFIGS } from '../../services/mockData';
import { ToastMessage, ToastType } from '../../components/Toast';
import { usePersistedState } from '../usePersistedState';

export const useNotificationLogic = (currentUserRole: string, currentUserId: string) => {
  // Persistent State
  const [notifications, setNotifications] = usePersistedState<Notification[]>('ebs_notifications_v1', INITIAL_NOTIFICATIONS);
  const [notificationConfigs, setNotificationConfigs] = usePersistedState<NotificationConfig[]>('ebs_notif_configs_v1', INITIAL_NOTIFICATION_CONFIGS);
  
  // Toasts are transient, standard useState
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Toasts ---
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Notifications ---
  const notifyUser = useCallback((userId: string | 'ALL_ADMINS', message: string, type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO', action?: NotificationAction, targetEntityId?: string, targetEntityType?: any) => {
    const newNotif: Notification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      message,
      type,
      read: false,
      date: new Date().toISOString(),
      action,
      targetEntityId,
      targetEntityType
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, [setNotifications]);

  const handleMarkNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => 
      (n.userId === currentUserId || (currentUserRole === 'SUPERADMIN' && n.userId === 'ALL_ADMINS')) 
      ? { ...n, read: true } : n
    ));
  }, [currentUserId, currentUserRole, setNotifications]);

  const handleMarkSingleNotificationRead = useCallback((notificationId: string) => {
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, [setNotifications]);

  const handleClearNotifications = useCallback(() => {
      setNotifications(prev => prev.filter(n => n.userId !== currentUserId && n.userId !== 'ALL_ADMINS'));
  }, [currentUserId, setNotifications]);

  const handleUpdateNotificationConfig = useCallback((updatedConfig: NotificationConfig) => {
    setNotificationConfigs(prev => prev.map(c => c.id === updatedConfig.id ? updatedConfig : c));
    addToast("Powiadomienia", "Ustawienia powiadomień zostały zaktualizowane.", "INFO");
  }, [addToast, setNotificationConfigs]);

  return {
    notifications,
    notificationConfigs,
    toasts,
    setNotifications,
    setNotificationConfigs,
    addToast,
    removeToast,
    notifyUser,
    handleMarkNotificationsRead,
    handleMarkSingleNotificationRead,
    handleClearNotifications,
    handleUpdateNotificationConfig
  };
};
