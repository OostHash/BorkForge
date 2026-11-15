import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, MessageSquare, RotateCcw } from "lucide-react";
import { useState } from "react";
import { logSale, revertListing, setWhispers, useTradingAction, useWhispers } from "../../../api/trading";
import { inviteText, revertHint, soldText, type Whisper } from "../../../domain/trading";
import { Button } from "../../../primitives/actions";
import { Badge, Card, EmptyState } from "../../../primitives/display";
import { toast } from "../../../primitives/overlay";
import { fmt } from "../shared";

const copy = (text: string, done: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => toast({ title: done, tone: "success" }))
    .catch(() => toast({ title: "Could not copy to the clipboard", tone: "danger" }));
};

function WhisperCard({ w }: { w: Whisper }) {
  const queryClient = useQueryClient();
  const action = useTradingAction();
  const [reverting, setReverting] = useState(false);
  const remove = () => {
    setWhispers(queryClient, (list) => list.filter((x) => x.id !== w.id));
  };
  return (
    <li>
      <Card as="article" padding="sm" className={w.completedAt !== undefined ? "border-success/50" : ""}>
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{w.from}</h3>
          <span className="text-xs text-muted">{w.timestamp}</span>
        </header>
        {w.completedAt !== undefined && (
          <Badge tone="success" icon={CircleCheck}>
            Completed in game · closes in 5 min
          </Badge>
        )}
        {w.item && (
          <p className="text-sm text-muted">
            Wants <span className="font-medium text-text">{w.item}</span>
            {w.price !== undefined && <span className="tabular-nums"> · {fmt(w.price)}p</span>}
          </p>
        )}
        {w.completedAt === undefined && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                copy(inviteText(w.from), `Invite for ${w.from} copied`);
              }}
            >
              Copy invite
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                copy(soldText(w.from, w.item), `Thank-you for ${w.from} copied`);
                if (w.item) {
                  logSale(w.from, w.item, w.price ?? 0).catch((e: unknown) => {
                    toast({ title: "Could not log the trade", description: String(e), tone: "danger" });
                  });
                }
                setWhispers(queryClient, (list) => list.filter((x) => x.from !== w.from));
              }}
            >
              Sold
            </Button>
            <Button size="sm" variant="ghost" onClick={remove}>
              Ignore
            </Button>
          </div>
        )}
        {w.completedAt !== undefined && w.revertInfo && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className="flex-1">{revertHint(w.revertInfo)}</span>
            <Button
              size="sm"
              leadingIcon={RotateCcw}
              loading={reverting}
              onClick={() => {
                const info = w.revertInfo;
                if (!info) return;
                setReverting(true);
                action.mutate(() => revertListing(info), {
                  onSuccess: () => {
                    setWhispers(queryClient, (list) =>
                      list.map((x) => {
                        if (x.id !== w.id) return x;
                        const rest = { ...x };
                        delete rest.revertInfo;
                        return rest;
                      }),
                    );
                    toast({ title: "Listing restored", tone: "success" });
                  },
                  onError: (e) => toast({ title: "Could not restore the listing", description: e.message, tone: "danger" }),
                  onSettled: () => {
                    setReverting(false);
                  },
                });
              }}
            >
              Revert
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}

/** Trade whispers from the game log, oldest first. */
export function MessagesPanel() {
  const queryClient = useQueryClient();
  const whispers = useWhispers();
  if (whispers.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No trade whispers yet."
        description="When someone whispers you a warframe.market trade offer, it shows up here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="self-end"
        onClick={() => {
          setWhispers(queryClient, () => []);
        }}
      >
        Clear all
      </Button>
      <ul aria-label="Trade whispers" className="flex flex-col gap-2">
        {whispers.map((w) => (
          <WhisperCard key={w.id} w={w} />
        ))}
      </ul>
    </div>
  );
}
