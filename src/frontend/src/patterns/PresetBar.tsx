import { ArrowDown, ArrowUp, Bookmark, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../primitives/actions";
import { Chip } from "../primitives/display";
import { Input } from "../primitives/forms";
import { Popover } from "../primitives/overlay";

/** What PresetBar needs; api/presets.ts `useFilterPresets` provides it. */
export type PresetBarModel = {
  presets: ReadonlyArray<{ id: string; name: string; pinned?: boolean }>;
  isActive: (id: string) => boolean;
  apply: (id: string) => void;
  saveCurrent: (name: string) => void;
  rename: (id: string, name: string) => void;
  togglePin: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  remove: (id: string) => void;
  clear: { label: string; disabled: boolean; run: () => void };
};

function NameForm({
  initial,
  label,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
      className="flex items-center gap-1"
    >
      <Input
        size="sm"
        aria-label={label}
        value={name}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the form opens from a button; focus belongs in the field
        autoFocus
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <Button size="sm" variant="primary" type="submit" disabled={!name.trim()}>
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

/** What managing presets needs; apply and isActive only where filters exist (not in Settings). */
export type PresetListModel = Pick<PresetBarModel, "presets" | "rename" | "togglePin" | "move" | "remove"> &
  Partial<Pick<PresetBarModel, "isActive" | "apply">>;

function PresetRow({
  preset,
  model,
  index,
  groupSize,
}: {
  preset: PresetBarModel["presets"][number];
  model: PresetListModel;
  index: number;
  groupSize: number;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  if (mode === "rename") {
    return (
      <li>
        <NameForm
          initial={preset.name}
          label={`New name for ${preset.name}`}
          onCancel={() => {
            setMode("view");
          }}
          onSubmit={(name) => {
            model.rename(preset.id, name);
            setMode("view");
          }}
        />
      </li>
    );
  }
  if (mode === "delete") {
    return (
      <li className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">Delete “{preset.name}”?</span>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            model.remove(preset.id);
          }}
        >
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode("view");
          }}
        >
          Cancel
        </Button>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1">
      {model.apply && model.isActive ? (
        <Chip
          active={model.isActive(preset.id)}
          onActiveChange={() => {
            model.apply?.(preset.id);
          }}
          className="min-w-0 flex-1 justify-start truncate"
        >
          {preset.name}
        </Chip>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{preset.name}</span>
      )}
      <IconButton
        size="sm"
        icon={ArrowUp}
        label={`Move ${preset.name} up`}
        disabled={index === 0}
        onClick={() => {
          model.move(preset.id, -1);
        }}
      />
      <IconButton
        size="sm"
        icon={ArrowDown}
        label={`Move ${preset.name} down`}
        disabled={index === groupSize - 1}
        onClick={() => {
          model.move(preset.id, 1);
        }}
      />
      <IconButton
        size="sm"
        icon={Pencil}
        label={`Rename ${preset.name}`}
        onClick={() => {
          setMode("rename");
        }}
      />
      <IconButton
        size="sm"
        icon={preset.pinned ? PinOff : Pin}
        label={`${preset.pinned ? "Unpin" : "Pin"} ${preset.name}`}
        pressed={preset.pinned === true}
        onClick={() => {
          model.togglePin(preset.id);
        }}
      />
      <IconButton
        size="sm"
        variant="danger"
        icon={Trash2}
        label={`Delete ${preset.name}`}
        onClick={() => {
          setMode("delete");
        }}
      />
    </li>
  );
}

/** Pinned and saved presets with move, rename, pin and delete (Presets popover, Settings). */
export function PresetList({ model }: { model: PresetListModel }) {
  const pinned = model.presets.filter((p) => p.pinned);
  const saved = model.presets.filter((p) => !p.pinned);
  return (
    <>
      {model.presets.length === 0 && <p className="text-sm text-muted">No presets yet.</p>}
      {(
        [
          ["Pinned", pinned],
          ["Saved", saved],
        ] as const
      ).map(([title, group]) =>
        group.length > 0 ? (
          <section key={title} aria-label={`${title} presets`} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium text-muted">{title}</h3>
            <ul className="flex flex-col gap-1">
              {group.map((p, i) => (
                <PresetRow key={p.id} preset={p} model={model} index={i} groupSize={group.length} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </>
  );
}

/**
 * Pinned presets as chips, a "Presets" popover to save and manage them, and
 * Clear / Restore filters. Ordering uses move buttons instead of dragging,
 * so it works with the keyboard.
 */
export function PresetBar({ model, label }: { model: PresetBarModel; label: string }) {
  const [saving, setSaving] = useState(false);
  const pinned = model.presets.filter((p) => p.pinned);
  return (
    <div role="group" aria-label={`${label} presets`} className="flex flex-wrap items-center gap-1">
      {pinned.map((p) => (
        <Chip
          key={p.id}
          active={model.isActive(p.id)}
          onActiveChange={() => {
            model.apply(p.id);
          }}
        >
          {p.name}
        </Chip>
      ))}
      <Popover
        label={`${label} presets`}
        placement="bottom"
        className="w-96"
        trigger={(props) => (
          <button
            type="button"
            className="inline-flex h-control-sm items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted hover:bg-hover hover:text-text"
            {...props}
          >
            <Bookmark aria-hidden="true" className="size-3" />
            Presets
          </button>
        )}
      >
        <div className="flex flex-col gap-3">
          {saving ? (
            <NameForm
              initial=""
              label="Preset name"
              onCancel={() => {
                setSaving(false);
              }}
              onSubmit={(name) => {
                model.saveCurrent(name);
                setSaving(false);
              }}
            />
          ) : (
            <Button
              size="sm"
              leadingIcon={Plus}
              onClick={() => {
                setSaving(true);
              }}
              className="self-start"
            >
              Save current filters
            </Button>
          )}
          <PresetList model={model} />
        </div>
      </Popover>
      <Button size="sm" variant="ghost" disabled={model.clear.disabled} onClick={model.clear.run}>
        {model.clear.label}
      </Button>
    </div>
  );
}
