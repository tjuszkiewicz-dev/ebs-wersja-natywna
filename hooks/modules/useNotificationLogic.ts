
import { useState, useCallback, useEffect } from 'react';
import { Notification, NotificationAction, NotificationConfig } from '../../types';
import { ToastMessage, ToastType } from '../../components/Toast';

export const useNotificationLogic = (currentUserRole: string, currentUserId: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationConfigs, setNotificationConfigs] = useState<NotificationConfig[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Pobierz powiadomienia z API przy starcie ---
  useEffect(() => {
    if (!currentUserId) return;
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const mapped: Notification[] = data.map(n => ({
          id: n.id,
          userId: n.user_id,
          message: n.message,
          type: n.type,
          read: n.read,
          date: n.date,
          priority: n.priority,
          action: n.action,
          targetEntityId: n.target_entity_id,
          targetEntityType: n.target_entity_type,
        }));
        setNotifications(mapped);
      })
      .catch(() => {});
  }, [currentUserId]);

  // --- Pobierz konfiguracje powiadomień z API (superadmin/pracodawca) ---
  useEffect(() => {
    if (!currentUserId) return;
    if (!['SUPERADMIN', 'HR'].includes(currentUserRole)) return;
    fetch('/api/notification-configs')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const mapped: NotificationConfig[] = data.map(c => ({
          id:              c.id,
          target:          c.target,
          trigger:         c.trigger,
          messageTemplate: '',   // brak kolumny w DB — UI może nadpisać lokalnie
          isEnabled:       c.enabled ?? true,
        }));
        setNotificationConfigs(mapped);
      })
      .catch(() => {});
  }, [currentUserId, currentUserRole]);

  // --- Toasts (zawsze lokalne — UI feedback) ---
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Powiadomienia ---

  const notifyUser = useCallback((
    userId: string | 'ALL_ADMINS',
    message: string,
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO',
    action?: NotificationAction,
    targetEntityId?: string,
    targetEntityType?: any
  ) => {
    // Optimistic update — dodaj lokalnie od razu
    const tempId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newNotif: Notification = {
      id: tempId,
      userId,
      message,
      type,
      read: false,
      date: new Date().toISOString(),
      action,
      targetEntityId,
      targetEntityType,
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Wyślij na serwer (tylko superadmin może tworzyć powiadomienia dla innych)
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, type, action, targetEntityId, targetEntityType }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(saved => {
        if (saved) {
          // Zastąp temp ID prawdziwym z bazy
          setNotifications(prev => prev.map(n => n.id === tempId ? { ...n, id: saved.id } : n));
        }
      })
      .catch(() => {});
  }, []);

  const handleMarkNotificationsRead = useCallback(() => {
    // Optimistic
    setNotifications(prev => prev.map(n =>
      (n.userId === currentUserId || (currentUserRole === 'SUPERADMIN' && n.userId === 'ALL_ADMINS'))
        ? { ...n, read: true }
        : n
    ));
    fetch('/api/notifications/mark-read', { method: 'PATCH' }).catch(() => {});
  }, [currentUserId, currentUserRole]);

  const handleMarkSingleNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' }).catch(() => {});
  }, []);

  const handleClearNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(n => n.userId !== currentUserId && n.userId !== 'ALL_ADMINS'));
    fetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
  }, [currentUserId]);

  const handleUpdateNotificationConfig = useCallback((updatedConfig: NotificationConfig) => {
    setNotificationConfigs(prev => prev.map(c => c.id === updatedConfig.id ? updatedConfig : c));
    fetch(`/api/notification-configs/${updatedConfig.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isEnabled: updatedConfig.isEnabled,
        target:    updatedConfig.target,
        trigger:   updatedConfig.trigger,
      }),
    }).catch(() => {});
    addToast('Powiadomienia', 'Ustawienia powiadomień zostały zaktualizowane.', 'INFO');
  }, [addToast]);

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
    handleUpdateNotificationConfig,
  };
};
