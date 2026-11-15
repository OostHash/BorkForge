import { CircleCheck, Gamepad2, Hammer, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { imageSources } from "../../api/catalog";
import { useCraftableItems, useRecipes } from "../../api/foundry";
import type { Ownership } from "../../domain/completionist";
import { defaultExpanded, isLichWeapon, recipeTree, shoppingList, type RecipeTreeNode } from "../../domain/foundry";
import { ItemImage } from "../../patterns/ItemImage";
import { Tree, type TreeNode } from "../../primitives/data";
import { Alert, Badge, EmptyState, Spinner } from "../../primitives/display";
import { Tab, TabList, TabPanel, Tabs } from "../../primitives/navigation";
import { Modal } from "../../primitives/overlay";
import { FoundryWikiMenu, TrackButton, type CraftInfo } from "./CraftCard";
import { useCraftInfo } from "./useCraftInfo";

const fmt = (n: number) => n.toLocaleString("en-US");

const toTreeNodes = (nodes: readonly RecipeTreeNode[]): TreeNode[] =>
  nodes.map((n) => ({
    key: n.key,
    label: n.label,
    status: n.status,
    detail: n.owned >= n.needed ? `${fmt(n.owned)} / ${fmt(n.needed)}` : `${fmt(n.owned)} / ${fmt(n.needed)} · −${fmt(n.needed - n.owned)}`,
    ...(n.children ? { children: toTreeNodes(n.children) } : {}),
  }));

type Mode = "tree" | "needs";

function RecipeBody({ info, own }: { info: CraftInfo; own: Ownership }) {
  const [mode, setMode] = useState<Mode>("tree");
  const { item, recipe } = info;
  const tree = useMemo(() => (recipe ? recipeTree(recipe, own) : []), [recipe, own]);
  const needs = useMemo(() => (recipe ? shoppingList(recipe, own) : []), [recipe, own]);
  // The Tree reads defaultExpandedKeys only when it mounts: short nodes open, up to depth 3.
  const expanded = defaultExpanded(tree);

  if (isLichWeapon(item)) {
    return (
      <Alert tone="info" title="Not built in the Foundry">
        <span className="inline-flex items-center gap-1">
          <Swords aria-hidden="true" className="size-4" />
          {item.name} is obtained by converting a {item.name.startsWith("Kuva ") ? "Kuva Lich" : "Tenet Sister"}, not crafted from a blueprint.
        </span>
      </Alert>
    );
  }
  if (item.source_type) {
    return (
      <Alert tone="info" title="Acquired in-game">
        <span className="inline-flex items-center gap-1">
          <Gamepad2 aria-hidden="true" className="size-4" />
          {item.name} is acquired in-game and cannot be crafted in the Foundry.
        </span>
      </Alert>
    );
  }
  if (recipe === null) return <Spinner label="Loading recipe…" />;
  if (recipe.length === 0) return <EmptyState title="No recipe data." />;

  return (
    <Tabs selectedKey={mode} onSelectionChange={setMode}>
      <TabList label="Recipe view" appearance="pills">
        <Tab id="tree">Full tree</Tab>
        <Tab id="needs">What I need</Tab>
      </TabList>
      <TabPanel id="tree" className="pt-3">
        <Tree key={item.unique_name} label={`Recipe of ${item.name}`} nodes={toTreeNodes(tree)} defaultExpandedKeys={expanded} />
      </TabPanel>
      <TabPanel id="needs" className="pt-3">
        {needs.length === 0 ? (
          <EmptyState icon={CircleCheck} title="You have everything needed." />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Missing for {item.name}</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-1 text-start font-medium">
                  Item
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  Owned / needed
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  Short
                </th>
              </tr>
            </thead>
            <tbody>
              {needs.map((n) => (
                <tr key={n.unique_name} className="border-t border-border">
                  <td className="py-1.5">{n.name}</td>
                  <td className="py-1.5 text-end tabular-nums">
                    {fmt(n.owned)} / {fmt(n.needed)}
                  </td>
                  <td className="py-1.5 text-end text-danger tabular-nums">−{fmt(n.needed - n.owned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabPanel>
    </Tabs>
  );
}

type Props = {
  info: CraftInfo | null;
  own: Ownership;
  baseUrl: string | undefined;
  onClose: () => void;
  onToggleTrack: () => void;
};

/** Recipe of one item: full tree or what is still missing. */
export function RecipeModal({ info, own, baseUrl, onClose, onToggleTrack }: Props) {
  return (
    <Modal
      open={info !== null}
      onClose={onClose}
      size="lg"
      title={
        info && (
          <span className="flex items-center gap-2">
            <ItemImage size="sm" sources={imageSources(info.item.image_name ?? undefined, baseUrl)} name={info.item.name} />
            {info.item.name}
          </span>
        )
      }
      description={
        info?.building ? (
          <Badge tone="info" icon={Hammer}>
            Building in the Foundry
          </Badge>
        ) : undefined
      }
      footer={
        info && (
          <>
            <span className="me-auto text-xs text-muted">{info.tracked ? "Tracked in the modular window" : "Not tracked"}</span>
            <TrackButton name={info.item.name} tracked={info.tracked} onToggle={onToggleTrack} />
            <FoundryWikiMenu name={info.item.name} />
          </>
        )
      }
    >
      {info && <RecipeBody key={info.item.unique_name} info={info} own={own} />}
    </Modal>
  );
}

const NO_OPEN: () => void = () => undefined;

/** Recipe modal for any craftable item by uniqueName; shared by the equipment and syndicate views. */
export function RecipeHost({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const craftable = useCraftableItems();
  const { own, baseUrl, infoFor, toggleTrack } = useCraftInfo(NO_OPEN);
  const ids = useMemo(() => (openId ? [openId] : []), [openId]);
  const recipes = useRecipes(ids);
  const item = openId ? craftable.data?.find((i) => i.unique_name === openId) : undefined;
  return (
    <RecipeModal
      info={item ? infoFor(item, recipes?.get(item.unique_name) ?? null) : null}
      own={own}
      baseUrl={baseUrl}
      onClose={onClose}
      onToggleTrack={() => {
        if (item) toggleTrack(item);
      }}
    />
  );
}
