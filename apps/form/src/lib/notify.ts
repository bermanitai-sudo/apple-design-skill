export type PermissionState = NotificationPermission | 'unsupported';

export function notificationState(): PermissionState {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestNotifications(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Shows a system notification through the service worker, which is the only path iOS supports. */
export async function localNotify(title: string, body: string, data: Record<string, unknown> = {}): Promise<void> {
  if (notificationState() !== 'granted' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    data,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: String(data.tag ?? title),
  });
}
