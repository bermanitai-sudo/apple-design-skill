import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet } from '../../lib/db';
import { buildIcs } from '../../lib/ics';
import { downloadBlob } from '../../lib/backup';
import { isIOS, isStandalone, notificationState, requestNotifications, type PermissionState } from '../../lib/notify';
import { disableBackgroundAlarms, enableBackgroundAlarms, pushConfig } from '../../lib/push';
import { Button, Card, Toggle, cx, useToast } from '../../components/ui';

/** Explains what can and cannot wake an iPhone, and wires up each layer that can. */
export function AlarmReliability() {
  const toast = useToast();
  const [perm, setPerm] = useState<PermissionState>(notificationState());
  const [server, setServer] = useState<boolean | null>(null);
  const pushOn = useLiveQuery(() => kvGet<boolean>('pushEnabled'), [], false);
  const [busy, setBusy] = useState(false);
  const standalone = isStandalone();
  const ios = isIOS();

  useEffect(() => {
    void pushConfig().then((c) => setServer(c.enabled));
  }, []);

  const allow = async () => setPerm(await requestNotifications());

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        await enableBackgroundAlarms();
        toast('Background alarms on');
      } else {
        await disableBackgroundAlarms();
        toast('Background alarms off');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change background alarms');
    } finally {
      setBusy(false);
    }
  };

  const exportIcs = async () => {
    const ics = buildIcs(await db.alarms.toArray(), await db.events.toArray());
    downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'form-alarms.ics');
  };

  return (
    <Card className="space-y-4">
      <div>
        <p className="eyebrow">Alarm reliability</p>
        <p className="mt-1.5 text-[14px] leading-snug text-white/80">
          A web app cannot run code once iOS suspends it, so an in-app timer alone cannot wake you. FORM layers three methods; use the
          strongest you can.
        </p>
      </div>

      <Layer
        n={1}
        title="In-app alarm"
        state="Always on"
        on
        body="Exact, with sound and the automatic timer, while FORM is open on screen. Leave it open on a charger overnight for this to work."
      />

      <Layer
        n={2}
        title="Push notifications"
        on={perm === 'granted' && !!pushOn}
        state={
          perm === 'unsupported'
            ? ios && !standalone
              ? 'Install first'
              : 'Unsupported'
            : perm !== 'granted'
              ? 'Needs permission'
              : server === false
                ? 'Server not set up'
                : pushOn
                  ? 'On'
                  : 'Off'
        }
        body="Fires with the app closed, through a notification with the standard notification sound. Requires iOS 16.4+, FORM added to the Home Screen, and the server's push scheduler. Tap the notification to dismiss and start your timer."
      >
        {ios && !standalone && <p className="text-[12px] text-mute">Safari → Share → Add to Home Screen, then open FORM from its icon.</p>}
        {perm === 'default' && (
          <Button size="sm" variant="primary" onClick={() => void allow()}>
            Allow notifications
          </Button>
        )}
        {perm === 'denied' && <p className="text-[12px] text-mute">Notifications are blocked. Settings → Notifications → FORM → Allow.</p>}
        {perm === 'granted' && server && (
          <div className="flex items-center justify-between">
            <span className="text-[14px]">Background alarms</span>
            <Toggle checked={!!pushOn} onChange={(v) => !busy && void togglePush(v)} label="Background alarms" />
          </div>
        )}
      </Layer>

      <Layer
        n={3}
        title="iPhone Calendar backup"
        state="Manual"
        body="Exports your alarms and events with alerts to Calendar, which always alerts on time. Calendar alerts use your Calendar alert sound and do not start FORM's timer. Re-export after changing alarms."
      >
        <Button size="sm" onClick={() => void exportIcs()}>
          Export to Calendar
        </Button>
      </Layer>

      <p className="text-[12px] leading-snug text-faint">
        For a wake-up you cannot miss, also set the same time in the iPhone Clock app. No web app can override Silent mode, Focus or Do Not
        Disturb.
      </p>
    </Card>
  );
}

function Layer({
  n,
  title,
  state,
  body,
  on,
  children,
}: {
  n: number;
  title: string;
  state: string;
  body: string;
  on?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cx(
          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold',
          on ? 'bg-lime text-[#0b1400]' : 'bg-white/10 text-white/70',
        )}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className={cx('text-[12px] font-semibold', on ? 'text-lime' : 'text-mute')}>{state}</span>
        </div>
        <p className="text-[13px] leading-snug text-mute">{body}</p>
        {children}
      </div>
    </div>
  );
}
