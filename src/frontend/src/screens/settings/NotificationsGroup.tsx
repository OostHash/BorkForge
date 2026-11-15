import { useState } from "react";
import { ensureNotificationPermission, notify } from "../../api/notifications";
import { Button } from "../../primitives/actions";
import { ResultText, SettingRow, SettingsGroup, SwitchRow, useSettingsFile } from "./parts";

/** Fissure watch notifications and a test send (Settings → General). */
export function NotificationsGroup() {
  const { settings, set } = useSettingsFile();
  const enabled = settings.fissureNotifications !== false;
  const [denied, setDenied] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <SettingsGroup title="Notifications">
      <SwitchRow
        label="Notify me"
        description="Desktop notification when a fissure matching one of your Timers watches appears."
        checked={enabled}
        onCheckedChange={(on) => {
          if (!on) {
            set({ fissureNotifications: false });
            return;
          }
          // Stays off when the OS refuses, rather than promising alerts that cannot arrive.
          void ensureNotificationPermission().then((granted) => {
            setDenied(!granted);
            set({ fissureNotifications: granted });
          });
        }}
      />
      {denied && (
        <div>
          <ResultText tone="danger">Notifications are blocked for FrameForge in your system settings.</ResultText>
        </div>
      )}
      <SettingRow
        label="Test notification"
        description="Send a desktop notification now, to check that Windows delivers them at all."
        info={
          <>
            If &quot;Sent&quot; shows but nothing appears, check Windows Settings → System → Notifications and make sure the main
            &quot;Notifications&quot; switch at the top is on. Windows drops every notification silently when it is off.
          </>
        }
        result={test && <ResultText tone={test.ok ? "success" : "danger"}>{test.text}</ResultText>}
      >
        <Button
          size="sm"
          onClick={() => {
            setTest(null);
            void ensureNotificationPermission().then(async (granted) => {
              if (!granted) {
                setTest({ ok: false, text: "Permission denied: notifications are blocked for FrameForge in your system settings." });
                return;
              }
              await notify("FrameForge", "Test notification: watched fissure alerts will look like this.");
              setTest({ ok: true, text: "Sent. If nothing appeared, Windows is dropping it." });
            });
          }}
        >
          Send test notification
        </Button>
      </SettingRow>
    </SettingsGroup>
  );
}
