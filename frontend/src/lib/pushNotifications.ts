/**
 * RepairHub Push Notifications Utility
 * 
 * Safely manages Web Push & Browser Notifications with user consent.
 */

export interface PushNotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission;
}

export function getNotificationStatus(): PushNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { isSupported: false, permission: 'default' };
  }

  return {
    isSupported: true,
    permission: Notification.permission,
  };
}

/**
 * Requests permission strictly after an intentional user action.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[PWA Push] Notification permission granted.');
    }
    return permission;
  } catch (err) {
    console.warn('[PWA Push] Error requesting permission:', err);
    return 'denied';
  }
}

/**
 * Shows an immediate local confirmation notification if granted.
 */
export async function showLocalNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      ...options,
    });
  } else {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      ...options,
    });
  }
}
