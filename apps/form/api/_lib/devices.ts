import type { AlarmLike } from '../../src/lib/alarmMath';

export interface Reminder {
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

export interface Device {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  timeZone: string;
  alarms: AlarmLike[];
  reminders: Reminder[];
  updatedAt: number;
}

export const DEVICE_SET = 'form:devices';
export const deviceKey = (id: string) => `form:device:${id}`;
export const sentKey = (id: string, key: string) => `form:sent:${id}:${key}`;
