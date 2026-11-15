import { Pencil, Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRollActions, useSavedRolls } from "../../api/rivens";
import { filledStats, MAX_SAVED, parseRollStats, toggleCompare, type RollStat, type SavedRiven } from "../../domain/rivens";
import { Button, IconButton } from "../../primitives/actions";
import { Card } from "../../primitives/display";
import { Input } from "../../primitives/forms";
import { ConfirmDialog, toast } from "../../primitives/overlay";
import { VerdictBadge } from "./verdict";

const statText = (s: RollStat) => `${s.positive ? "+" : "−"}${s.value ? `${s.value.replace(/^-/, "")}% ` : ""}${s.name}`;

function StatList({ stats }: { stats: readonly RollStat[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {stats.map((s) => (
        <li key={s.name} className={s.positive ? "text-muted" : "text-danger"}>
          {statText(s)}
        </li>
      ))}
    </ul>
  );
}

function RollCard({ roll, selected, onCompare, onDelete }: { roll: SavedRiven; selected: boolean; onCompare: () => void; onDelete: () => void }) {
  const actions = useRollActions();
  const [label, setLabel] = useState(roll.label);
  const [editing, setEditing] = useState<{ label: string; stats: RollStat[] } | null>(null);
  const stats = parseRollStats(roll.stats_json);
  const rename = () => {
    const next = label.trim();
    if (next && next !== roll.label) actions.rename.mutate({ id: roll.id, label: next });
    else setLabel(roll.label);
  };

  return (
    <li>
      <Card as="article" padding="sm" className={selected ? "flex h-full flex-col gap-2 border-accent" : "flex h-full flex-col gap-2"}>
        <header className="flex items-center gap-1">
          {editing ? (
            <Input
              size="sm"
              aria-label="Roll name"
              value={editing.label}
              onChange={(e) => {
                setEditing({ ...editing, label: e.target.value });
              }}
            />
          ) : (
            <Input
              size="sm"
              aria-label={`Name of ${roll.label}`}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
              onBlur={rename}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename();
              }}
              className="border-transparent bg-transparent font-semibold"
            />
          )}
          {!editing && (
            <>
              <IconButton
                icon={Scale}
                size="sm"
                pressed={selected}
                label={selected ? `Stop comparing ${roll.label}` : `Compare ${roll.label}`}
                onClick={onCompare}
              />
              <IconButton
                icon={Pencil}
                size="sm"
                label={`Edit ${roll.label}`}
                onClick={() => {
                  setEditing({ label: roll.label, stats });
                }}
              />
              <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${roll.label}`} onClick={onDelete} />
            </>
          )}
        </header>
        {roll.verdict && (
          <div>
            <VerdictBadge verdict={roll.verdict} short score={roll.score} />
          </div>
        )}
        {editing ? (
          <form
            aria-label={`Edit ${roll.label}`}
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              actions.save.mutate(
                {
                  replaceId: roll.id,
                  weapon: roll.weapon,
                  label: editing.label.trim() || roll.label,
                  stats: filledStats(editing.stats),
                  verdict: roll.verdict,
                  score: roll.score,
                },
                {
                  onSuccess: () => {
                    setEditing(null);
                    toast({ title: "Roll updated", tone: "success" });
                  },
                  onError: (e) => toast({ title: "Could not update the roll", description: e.message, tone: "danger" }),
                },
              );
            }}
          >
            <ul className="flex flex-col gap-1">
              {editing.stats.map((s, i) => (
                <li key={s.name} className="flex items-center gap-1 text-xs">
                  <Button
                    size="sm"
                    variant={s.positive ? "secondary" : "danger"}
                    aria-label={s.positive ? `${s.name} is positive; make it negative` : `${s.name} is negative; make it positive`}
                    onClick={() => {
                      setEditing({ ...editing, stats: editing.stats.map((x, j) => (j === i ? { ...x, positive: !x.positive } : x)) });
                    }}
                    className="w-7 justify-center"
                  >
                    {s.positive ? "+" : "−"}
                  </Button>
                  <Input
                    size="sm"
                    aria-label={`${s.name} value`}
                    value={s.value}
                    onChange={(e) => {
                      setEditing({ ...editing, stats: editing.stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) });
                    }}
                    className="w-16 text-end"
                  />
                  <span className="text-muted">% {s.name}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" type="submit" variant="primary" loading={actions.save.isPending}>
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <StatList stats={stats} />
        )}
        <time className="mt-auto text-xs text-muted" dateTime={roll.saved_at}>
          {roll.saved_at.slice(0, 10)}
        </time>
      </Card>
    </li>
  );
}

/** Saved rolls: rename, edit, delete and compare two side by side. */
export function SavedRolls() {
  const saved = useSavedRolls();
  const actions = useRollActions();
  const [compare, setCompare] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<SavedRiven | null>(null);
  const rolls = saved.data ?? [];
  if (rolls.length === 0) return null;
  const compared = rolls.filter((r) => compare.has(r.id));

  return (
    <section aria-labelledby="saved-rolls" className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 id="saved-rolls" className="text-sm font-semibold">
          Saved rolls{" "}
          <span className="font-normal text-muted tabular-nums">
            ({rolls.length}/{MAX_SAVED})
          </span>
        </h3>
        {compare.size === 1 && <span className="text-xs text-muted">Select one more to compare.</span>}
      </header>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))] gap-3">
        {rolls.map((r) => (
          <RollCard
            key={`${r.id}-${r.label}`}
            roll={r}
            selected={compare.has(r.id)}
            onCompare={() => {
              setCompare(toggleCompare(compare, r.id));
            }}
            onDelete={() => {
              setConfirm(r);
            }}
          />
        ))}
      </ul>
      {compared.length === 2 && (
        <section aria-label="Comparison">
          <Card padding="md" className="grid grid-cols-2 gap-4 border-accent/40">
            {compared.map((r) => (
              <div key={r.id} className="flex flex-col gap-1">
                <h4 className="border-b border-border pb-1 text-sm font-semibold">{r.label}</h4>
                {r.verdict && (
                  <div>
                    <VerdictBadge verdict={r.verdict} short score={r.score} />
                  </div>
                )}
                <StatList stats={parseRollStats(r.stats_json)} />
              </div>
            ))}
          </Card>
        </section>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
        }}
        destructive
        title={confirm ? `Delete ${confirm.label}?` : ""}
        description="The saved roll is removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = confirm;
          if (!target) return;
          actions.remove.mutate(target.id, {
            onSettled: () => {
              setConfirm(null);
              const next = new Set(compare);
              next.delete(target.id);
              setCompare(next);
            },
          });
        }}
      />
    </section>
  );
}
