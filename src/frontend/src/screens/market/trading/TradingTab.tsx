import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { markRead, useLogout, useSession, useSetStatus, useUnread } from "../../../api/trading";
import { STATUS_LABEL, type SettableStatus } from "../../../domain/trading";
import { Button } from "../../../primitives/actions";
import { Alert, Badge, Spinner } from "../../../primitives/display";
import { RadioGroup } from "../../../primitives/forms";
import type { MarketTarget } from "../shared";
import { ListingsPanel } from "./ListingsPanel";
import { LoginPanel } from "./LoginPanel";
import { MessagesPanel } from "./MessagesPanel";

type View = "listings" | "messages";

/** warframe.market account: login, status, listings and trade whispers. */
export function TradingTab({ onEdit }: { onEdit: (target: MarketTarget) => void }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const setStatus = useSetStatus();
  const logout = useLogout();
  const unread = useUnread();
  const [view, setView] = useState<View>("listings");

  // Whispers that arrive while Messages is open are read right away.
  useEffect(() => {
    if (view === "messages" && unread > 0) markRead(queryClient);
  }, [view, unread, queryClient]);

  if (session.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Spinner label="Connecting to warframe.market…" />
      </div>
    );
  }
  const user = session.data;
  if (!user) return <LoginPanel />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-3 lg:px-6">
        <RadioGroup
          legend="Trading view"
          hideLegend
          appearance="segmented"
          value={view}
          onValueChange={setView}
          options={[
            { value: "listings", label: "Listings" },
            { value: "messages", label: unread > 0 ? `Messages (${String(unread)} new)` : "Messages" },
          ]}
        />
        <div className="ms-auto flex flex-wrap items-center gap-3">
          {user.status === "offline" && <Badge tone="warning">Offline — reconnecting</Badge>}
          <RadioGroup
            legend="Status on warframe.market"
            hideLegend
            appearance="segmented"
            value={user.status === "offline" ? ("" as SettableStatus) : user.status}
            onValueChange={(status) => {
              setStatus.mutate(status);
            }}
            options={(["online", "ingame", "invisible"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
          <span className="text-sm font-semibold">{user.user}</span>
          <Button size="sm" variant="ghost" leadingIcon={LogOut} onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
      {setStatus.isError && (
        <Alert tone="danger" title="Could not change your status." className="m-3 shrink-0">
          {setStatus.error.message || String(setStatus.error)}
        </Alert>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{view === "listings" ? <ListingsPanel onEdit={onEdit} /> : <MessagesPanel />}</div>
    </div>
  );
}
