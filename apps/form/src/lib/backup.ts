import { db } from './db';

const TABLES = ['runs', 'foods', 'alarms', 'events', 'days', 'pushups', 'kv'] as const;
type TableName = (typeof TABLES)[number];

export interface Backup {
  app: 'form';
  version: 1;
  exportedAt: string;
  data: Record<TableName, unknown[]>;
}

export async function exportBackup(): Promise<Backup> {
  const data = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  data.kv = (data.kv as { key: string }[]).filter((r) => r.key !== 'deviceId');
  return { app: 'form', version: 1, exportedAt: new Date().toISOString(), data };
}

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function parseBackup(text: string): Backup {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const b = obj as Partial<Backup>;
  if (b?.app !== 'form' || b.version !== 1 || typeof b.data !== 'object' || !b.data) throw new Error('That file is not a FORM backup.');
  for (const t of TABLES) if (!Array.isArray(b.data[t])) throw new Error(`Backup is missing "${t}".`);
  return b as Backup;
}

/** Replaces everything on this device with the backup, atomically. */
export async function restoreBackup(b: Backup): Promise<void> {
  const tables = TABLES.map((t) => db.table(t));
  await db.transaction('rw', tables, async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(b.data[t] as never[]);
    }
  });
}

export async function eraseEverything(): Promise<void> {
  await db.transaction(
    'rw',
    TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of TABLES) await db.table(t).clear();
    },
  );
}
