import { useState } from "react";
import { BATCH_LABEL, BATCH_MODS, BATCH_STATES, batchCards, type BatchState } from "../../domain/debug";
import { RadioGroup } from "../../primitives/forms";
import { Modal } from "../../primitives/overlay";
import { ItemCard } from "./ItemCard";

const OPTIONS = BATCH_STATES.map((value) => ({ value, label: BATCH_LABEL[value] }));

/**
 * Settings → Debugging → Inventory preview: the inventory's own cards for
 * each kind of change, without touching the inventory (vault debugging.md).
 * The app shell mounts it; Settings only opens it (state/batchPreview).
 */
export function BatchPreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<BatchState>("all");
  return (
    <Modal open={open} onClose={onClose} title="Incoming batch preview" description="Example cards; your inventory does not change." size="lg">
      <div className="flex flex-col gap-3">
        <RadioGroup legend="Show" appearance="segmented" value={state} options={OPTIONS} onValueChange={setState} />
        <ul aria-label="Preview cards" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
          {batchCards(state).map((c) => (
            <ItemCard
              key={c.row.item.unique_name}
              row={c.row}
              extras={{
                favorite: false,
                onToggleFavorite: () => undefined,
                building: c.building,
                recent: c.recent,
                baseUrl: undefined,
                mods: BATCH_MODS,
              }}
            />
          ))}
        </ul>
      </div>
    </Modal>
  );
}
