import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Minus, Pencil, RefreshCw, RotateCcw, Trash2, CircleCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useWfmItems } from "../../../api/market";
import {
  deleteAuction,
  deleteOrder,
  revertListing,
  setAuctionVisible,
  tradingKeys,
  updateOrder,
  useItemNames,
  useListingChanges,
  useMyAuctions,
  useMyOrders,
  useTradingAction,
} from "../../../api/trading";
import { normalizeForWfm } from "../../../domain/market";
import {
  auctionName,
  auctionPrice,
  isRivenOrder,
  orderName,
  type ListingChange,
  type WfmAuction,
  type WfmManagedOrder,
} from "../../../domain/trading";
import { Button, IconButton } from "../../../primitives/actions";
import { Table, type TableColumn } from "../../../primitives/data";
import { Badge, domainTone } from "../../../primitives/display";
import { SearchInput } from "../../../primitives/forms";
import { ConfirmDialog, toast } from "../../../primitives/overlay";
import { fmt, type MarketTarget } from "../shared";
import { AuctionEditModal } from "./AuctionEditModal";

type Row = { kind: "order"; order: WfmManagedOrder; name: string } | { kind: "auction"; auction: WfmAuction };

function Section({ title, count, actions, children }: { title: string; count: number; actions?: ReactNode; children: ReactNode }) {
  const id = `section-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={id} className="text-sm font-semibold">
          {title} <span className="font-normal text-muted tabular-nums">({count})</span>
        </h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

const TYPE_BADGE = {
  sell: <Badge tone="success">Sell</Badge>,
  buy: <Badge tone="info">Buy</Badge>,
  direct: (
    <Badge tone="domain" style={domainTone("direct-trade")}>
      Direct sale
    </Badge>
  ),
  auction: (
    <Badge tone="domain" style={domainTone("ducat")}>
      Auction
    </Badge>
  ),
};

/** My warframe.market listings, riven auctions and automatic updates after trades. */
export function ListingsPanel({ onEdit }: { onEdit: (target: MarketTarget) => void }) {
  const queryClient = useQueryClient();
  const orders = useMyOrders(true);
  const auctions = useMyAuctions(true);
  const names = useItemNames();
  const wfmItems = useWfmItems().data;
  const changes = useListingChanges();
  const action = useTradingAction();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [editingAuction, setEditingAuction] = useState<WfmAuction | null>(null);

  const all = useMemo(() => orders.data ?? [], [orders.data]);
  const regular = all.filter((o) => !isRivenOrder(o, names));
  const rivenOrders = all.filter((o) => isRivenOrder(o, names));
  const q = search.trim().toLowerCase();
  const shown = q ? regular.filter((o) => orderName(o, names).toLowerCase().includes(q)) : regular;
  const rivenRows: Row[] = [
    ...rivenOrders.map((order): Row => ({ kind: "order", order, name: orderName(order, names) })),
    ...(auctions.data ?? []).map((auction): Row => ({ kind: "auction", auction })),
  ];
  const slugByName = useMemo(() => new Map((wfmItems ?? []).map((i) => [i.item_name.toLowerCase(), i.url_name])), [wfmItems]);

  const run = (fn: () => Promise<unknown>, failed: string) => {
    action.mutate(fn, { onError: (e) => toast({ title: failed, description: e.message, tone: "danger" }) });
  };
  const setOrdersVisible = (list: readonly WfmManagedOrder[], visible: boolean) => () =>
    Promise.all(list.map((o) => updateOrder({ orderId: o.id, platinum: o.platinum, quantity: o.quantity, visible })));
  const toggleOrder = (o: WfmManagedOrder) => {
    run(() => updateOrder({ orderId: o.id, platinum: o.platinum, quantity: o.quantity, visible: !o.visible }), "Could not change the listing");
  };
  const editOrder = (o: WfmManagedOrder) => {
    const name = orderName(o, names);
    onEdit({
      slug: slugByName.get(name.toLowerCase()) ?? o.item?.slug ?? o.item?.urlName ?? o.item?.url_name ?? normalizeForWfm(name),
      name,
      imageName: null,
      rank: o.rank ?? null,
      edit: { orderId: o.id, platinum: o.platinum, quantity: o.quantity, visible: o.visible },
    });
  };

  const orderColumns: Array<TableColumn<WfmManagedOrder>> = [
    {
      id: "visible",
      header: "Visible",
      hideHeader: true,
      cell: (o) => (
        <IconButton
          icon={o.visible ? Eye : EyeOff}
          size="sm"
          pressed={o.visible}
          label={o.visible ? `Hide ${orderName(o, names)}` : `Show ${orderName(o, names)}`}
          onClick={() => {
            toggleOrder(o);
          }}
        />
      ),
    },
    { id: "type", header: "Type", cell: (o) => TYPE_BADGE[o.type] },
    {
      id: "name",
      header: "Item",
      cell: (o) => (
        <span className={o.visible ? "" : "text-muted"}>
          {orderName(o, names)}
          {o.visible ? "" : " (hidden)"}
        </span>
      ),
    },
    { id: "price", header: "Price", align: "end", cell: (o) => <span className="font-semibold tabular-nums">{fmt(o.platinum)}p</span> },
    { id: "qty", header: "Qty", align: "end", cell: (o) => <span className="tabular-nums">{o.quantity}</span> },
    {
      id: "actions",
      header: "Actions",
      hideHeader: true,
      cell: (o) => (
        <span className="flex justify-end gap-1">
          <IconButton
            icon={Pencil}
            size="sm"
            label={`Edit ${orderName(o, names)}`}
            onClick={() => {
              editOrder(o);
            }}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="danger"
            label={`Delete ${orderName(o, names)}`}
            onClick={() => {
              setConfirm({ kind: "order", order: o, name: orderName(o, names) });
            }}
          />
        </span>
      ),
    },
  ];

  const rowName = (r: Row) => (r.kind === "order" ? r.name : `${auctionName(r.auction).weapon} ${auctionName(r.auction).mod}`.trim());
  const rivenColumns: Array<TableColumn<Row>> = [
    {
      id: "visible",
      header: "Visible",
      hideHeader: true,
      cell: (r) => {
        const visible = r.kind === "order" ? r.order.visible : r.auction.visible;
        return (
          <IconButton
            icon={visible ? Eye : EyeOff}
            size="sm"
            pressed={visible}
            label={visible ? `Hide ${rowName(r)}` : `Show ${rowName(r)}`}
            onClick={() => {
              if (r.kind === "order") toggleOrder(r.order);
              else run(() => setAuctionVisible(r.auction.id, !visible), "Could not change the auction");
            }}
          />
        );
      },
    },
    {
      id: "type",
      header: "Type",
      cell: (r) => (r.kind === "order" ? TYPE_BADGE[r.order.type] : r.auction.is_direct_sell ? TYPE_BADGE.direct : TYPE_BADGE.auction),
    },
    {
      id: "name",
      header: "Riven",
      cell: (r) => {
        if (r.kind === "order") return r.name;
        const { weapon, mod } = auctionName(r.auction);
        return (
          <span>
            {weapon} {mod && <em className="text-muted">{mod}</em>}
          </span>
        );
      },
    },
    {
      id: "price",
      header: "Price",
      align: "end",
      cell: (r) => <span className="font-semibold tabular-nums">{fmt(r.kind === "order" ? r.order.platinum : auctionPrice(r.auction))}p</span>,
    },
    {
      id: "detail",
      header: "Buyout / bids",
      cell: (r) =>
        r.kind === "order" ? (
          <span className="tabular-nums">×{r.order.quantity}</span>
        ) : r.auction.is_direct_sell ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="text-muted tabular-nums">
            buyout {r.auction.buyout_price !== null ? `${fmt(r.auction.buyout_price)}p` : "none"} · {r.auction.bids}{" "}
            {r.auction.bids === 1 ? "bid" : "bids"}
          </span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      hideHeader: true,
      cell: (r) => (
        <span className="flex justify-end gap-1">
          <IconButton
            icon={Pencil}
            size="sm"
            label={`Edit ${rowName(r)}`}
            onClick={() => {
              if (r.kind === "order") editOrder(r.order);
              else setEditingAuction(r.auction);
            }}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="danger"
            label={`Delete ${rowName(r)}`}
            onClick={() => {
              setConfirm(r);
            }}
          />
        </span>
      ),
    },
  ];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: tradingKeys.orders });
    void queryClient.invalidateQueries({ queryKey: tradingKeys.auctions });
  };
  const bulk = (label: string, fn: (visible: boolean) => () => Promise<unknown>) => (
    <>
      <Button
        size="sm"
        variant="ghost"
        leadingIcon={Eye}
        onClick={() => {
          run(fn(true), "Could not show all");
        }}
      >
        Show all<span className="sr-only"> {label}</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        leadingIcon={EyeOff}
        onClick={() => {
          run(fn(false), "Could not hide all");
        }}
      >
        Hide all<span className="sr-only"> {label}</span>
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Active listings"
        count={regular.length}
        actions={
          <>
            <IconButton icon={RefreshCw} size="sm" label="Refresh listings" onClick={refresh} />
            {regular.length > 0 && bulk("listings", (v) => setOrdersVisible(regular, v))}
          </>
        }
      >
        <p className="text-xs text-muted">To post a new listing, open a set or part in the Prime Sets tab.</p>
        <SearchInput label="Search listings" placeholder="Search listings…" value={search} onValueChange={setSearch} size="sm" className="w-64" />
        <Table
          label="Active listings"
          columns={orderColumns}
          data={shown}
          getRowId={(o) => o.id}
          loading={orders.isPending}
          empty={q ? "No listings match." : orders.isError ? "Could not load your listings." : "No active listings."}
        />
      </Section>

      <Section
        title="Rivens"
        count={rivenRows.length}
        actions={
          rivenRows.length > 0 &&
          bulk(
            "rivens",
            (v) => () => Promise.all([setOrdersVisible(rivenOrders, v)(), ...(auctions.data ?? []).map((a) => setAuctionVisible(a.id, v))]),
          )
        }
      >
        <Table
          label="Riven listings"
          columns={rivenColumns}
          data={rivenRows}
          getRowId={(r) => (r.kind === "order" ? r.order.id : r.auction.id)}
          loading={auctions.isPending && rivenOrders.length === 0}
          empty="No active riven listings. Post them from the Rivens screen."
        />
      </Section>

      {changes.length > 0 && <ChangesSection changes={changes} />}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
        }}
        destructive
        title={confirm ? `Delete ${rowName(confirm)}?` : ""}
        description="This removes the listing from warframe.market. It cannot be undone."
        confirmLabel="Delete"
        busy={action.isPending}
        onConfirm={() => {
          const target = confirm;
          if (!target) return;
          action.mutate(() => (target.kind === "order" ? deleteOrder(target.order.id) : deleteAuction(target.auction.id)), {
            onSuccess: () => {
              toast({ title: `${rowName(target)} deleted`, tone: "success" });
            },
            onError: (e) => toast({ title: "Could not delete the listing", description: e.message, tone: "danger" }),
            onSettled: () => {
              setConfirm(null);
            },
          });
        }}
      />
      <AuctionEditModal
        auction={editingAuction}
        onClose={() => {
          setEditingAuction(null);
        }}
      />
    </div>
  );
}

function ChangesSection({ changes }: { changes: readonly ListingChange[] }) {
  const queryClient = useQueryClient();
  const action = useTradingAction();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Section title="Auto-updated listings" count={changes.length}>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {changes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
            {c.action === "decreased" ? (
              <Badge tone="info" icon={Minus}>
                Decreased
              </Badge>
            ) : (
              <Badge tone="success" icon={CircleCheck}>
                Sold
              </Badge>
            )}
            <span className="min-w-0 flex-1">
              <strong>{c.itemName}</strong> ({fmt(c.platinum)}p){" "}
              {c.action === "decreased" ? `×${String(c.oldQty)} → ×${String(c.newQty)}` : "listing sold"}
              <span className="text-muted"> · {c.withPlayer}</span>
            </span>
            <time className="text-xs text-muted" dateTime={new Date(c.timestamp).toISOString()}>
              {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
            {c.reverted ? (
              <span className="text-xs text-muted italic">Reverted</span>
            ) : (
              c.revertInfo && (
                <Button
                  size="sm"
                  leadingIcon={RotateCcw}
                  loading={busy === c.id}
                  onClick={() => {
                    const info = c.revertInfo;
                    if (!info) return;
                    setBusy(c.id);
                    action.mutate(() => revertListing(info), {
                      onSuccess: () => {
                        queryClient.setQueryData<ListingChange[]>(tradingKeys.changes, (list) =>
                          (list ?? []).map((x) => (x.id === c.id ? { ...x, reverted: true } : x)),
                        );
                      },
                      onError: (e) => toast({ title: "Could not undo", description: e.message, tone: "danger" }),
                      onSettled: () => {
                        setBusy(null);
                      },
                    });
                  }}
                >
                  Undo
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
