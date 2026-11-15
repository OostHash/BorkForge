import { useState } from "react";
import { saveAuction, useTradingAction } from "../../../api/trading";
import { auctionName, type WfmAuction } from "../../../domain/trading";
import { Button } from "../../../primitives/actions";
import { Alert } from "../../../primitives/display";
import { FormField, Input, RadioGroup } from "../../../primitives/forms";
import { Modal, toast } from "../../../primitives/overlay";

/** Edit a riven auction: price, buyout, visibility, or switch auction ↔ direct sale. */
export function AuctionEditModal({ auction, onClose }: { auction: WfmAuction | null; onClose: () => void }) {
  return (
    <Modal open={auction !== null} onClose={onClose} size="sm" title={auction ? <AuctionTitle auction={auction} /> : ""}>
      {auction && <AuctionForm key={auction.id} auction={auction} onClose={onClose} />}
    </Modal>
  );
}

function AuctionTitle({ auction }: { auction: WfmAuction }) {
  const { weapon, mod } = auctionName(auction);
  return (
    <>
      {weapon} {mod && <em className="font-normal text-muted">{mod}</em>}
    </>
  );
}

function AuctionForm({ auction, onClose }: { auction: WfmAuction; onClose: () => void }) {
  const [type, setType] = useState<"auction" | "direct">(auction.is_direct_sell ? "direct" : "auction");
  const [price, setPrice] = useState(auction.buyout_price ?? auction.starting_price);
  const [start, setStart] = useState(auction.starting_price);
  const [buyout, setBuyout] = useState(auction.buyout_price !== null ? String(auction.buyout_price) : "");
  const [visible, setVisible] = useState<"visible" | "hidden">(auction.visible ? "visible" : "hidden");
  const action = useTradingAction();
  const direct = type === "direct";
  const switching = direct !== auction.is_direct_sell;

  return (
    <form
      aria-label="Edit auction"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const edit = direct
          ? { direct, start: Math.max(1, Math.round(price)), buyout: Math.max(1, Math.round(price)), visible: visible === "visible" }
          : {
              direct,
              start: Math.max(1, Math.round(start)),
              buyout: buyout.trim() === "" ? null : Math.max(1, Math.round(Number(buyout))),
              visible: visible === "visible",
            };
        action.mutate(() => saveAuction(auction.id, auction.is_direct_sell, edit), {
          onSuccess: () => {
            toast({ title: "Auction saved", tone: "success" });
            onClose();
          },
        });
      }}
    >
      <RadioGroup
        legend="Listing type"
        appearance="segmented"
        value={type}
        onValueChange={setType}
        options={[
          { value: "auction", label: "Auction" },
          { value: "direct", label: "Direct sale" },
        ]}
      />
      {switching && (
        <Alert tone="warning">
          Switching the type deletes and recreates the listing. Because of warframe.market rate limits this can take up to 20 seconds.
        </Alert>
      )}
      {direct ? (
        <FormField label="Price (platinum)" className="w-32">
          <Input
            type="number"
            size="sm"
            min={1}
            value={price}
            onChange={(e) => {
              setPrice(Number(e.target.value));
            }}
          />
        </FormField>
      ) : (
        <div className="flex flex-wrap gap-3">
          <FormField label="Start price (platinum)" className="w-36">
            <Input
              type="number"
              size="sm"
              min={1}
              value={start}
              onChange={(e) => {
                setStart(Number(e.target.value));
              }}
            />
          </FormField>
          <FormField label="Buyout (platinum)" description="Empty: no buyout." className="w-36">
            <Input
              type="number"
              size="sm"
              min={1}
              value={buyout}
              onChange={(e) => {
                setBuyout(e.target.value);
              }}
            />
          </FormField>
        </div>
      )}
      <RadioGroup
        legend="Visibility"
        appearance="segmented"
        value={visible}
        onValueChange={setVisible}
        options={[
          { value: "visible", label: "Visible" },
          { value: "hidden", label: "Hidden" },
        ]}
      />
      {action.isError && (
        <Alert tone="danger" title="The auction was not saved.">
          {action.error.message || String(action.error)}
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={action.isPending}>
          Save auction
        </Button>
      </div>
    </form>
  );
}
