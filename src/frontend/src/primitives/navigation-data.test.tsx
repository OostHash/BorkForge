import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../theme/index.css";
import { Table, Tree, type TableColumn, type TreeNode } from "./data";
import { Pagination, SidebarItem, Tab, TabList, TabPanel, Tabs } from "./navigation";

describe("Tabs", () => {
  it("moves selection with arrow keys and shows the matching panel", async () => {
    function Controlled() {
      const [tab, setTab] = useState<"normal" | "hard" | "storm">("normal");
      return (
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <TabList label="Fissures" appearance="pills">
            <Tab id="normal">Normal</Tab>
            <Tab id="hard">Steel Path</Tab>
            <Tab id="storm">Storms</Tab>
          </TabList>
          <TabPanel id="normal">Normal fissures</TabPanel>
          <TabPanel id="hard">Steel Path fissures</TabPanel>
          <TabPanel id="storm">Void storms</TabPanel>
        </Tabs>
      );
    }
    const screen = await render(<Controlled />);
    await userEvent.click(screen.getByRole("tab", { name: "Normal" }));
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("tab", { name: "Steel Path" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("tabpanel")).toHaveTextContent("Steel Path fissures");
    await userEvent.keyboard("{End}");
    await expect.element(screen.getByRole("tab", { name: "Storms" })).toHaveAttribute("aria-selected", "true");
  });
});

const RECIPE: TreeNode[] = [
  {
    key: "excal",
    label: "Excalibur Prime",
    status: "partial",
    children: [
      { key: "bp", label: "Blueprint", status: "owned" },
      {
        key: "chassis",
        label: "Chassis",
        status: "craftable",
        count: 1,
        children: [{ key: "ferrite", label: "Ferrite", status: "owned", count: 1000 }],
      },
      { key: "neuro", label: "Neuroptics", status: "missing" },
    ],
  },
];

describe("Tree", () => {
  it("expands and collapses with the keyboard and shows status as text", async () => {
    const screen = await render(<Tree label="Recipe" nodes={RECIPE} />);
    // Clicking a parent row toggles it; start from keyboard focus instead.
    await userEvent.tab();
    await expect.element(screen.getByRole("row", { name: /Excalibur Prime/ })).toHaveFocus();
    await expect.element(screen.getByRole("row", { name: /Blueprint/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("row", { name: /Chassis/ })).toBeVisible();
    await expect.element(screen.getByRole("gridcell", { name: "Neuroptics Missing" })).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByRole("row", { name: /Chassis/ })).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("disables the ends, is hidden for one page and reports changes", async () => {
    const onPage = vi.fn();
    const screen = await render(<Pagination page={0} pageCount={3} itemCount={42} itemLabel="relics" onPageChange={onPage} />);
    await expect.element(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await expect.element(screen.getByText("Page 1 of 3 · 42 relics")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenCalledWith(1);

    const single = await render(<Pagination page={0} pageCount={1} onPageChange={onPage} />);
    expect(single.container.querySelector("nav")).toBeNull();
  });
});

describe("SidebarItem", () => {
  it("marks the active entry with aria-current", async () => {
    const screen = await render(
      <nav aria-label="Categories">
        <SidebarItem active label="Warframes" count={12} />
        <SidebarItem active={false} label="Weapons" count={30} />
      </nav>,
    );
    await expect.element(screen.getByRole("button", { name: /Warframes/ })).toHaveAttribute("aria-current", "page");
    await expect.element(screen.getByRole("button", { name: /Weapons/ })).not.toHaveAttribute("aria-current");
  });
});

type Item = { id: string; name: string; ducats: number };
const COLUMNS: Array<TableColumn<Item>> = [
  { id: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
  { id: "ducats", header: "Ducats", cell: (r) => r.ducats, sortValue: (r) => r.ducats, align: "end" },
];

describe("Table", () => {
  it("sorts by column and exposes aria-sort", async () => {
    const data: Item[] = [
      { id: "a", name: "Akstiletto Prime", ducats: 45 },
      { id: "b", name: "Braton Prime", ducats: 15 },
      { id: "c", name: "Corinth Prime", ducats: 100 },
    ];
    const screen = await render(<Table label="Items" columns={COLUMNS} data={data} getRowId={(r) => r.id} />);
    await userEvent.click(screen.getByRole("button", { name: "Ducats" }));
    await expect.element(screen.getByRole("columnheader", { name: "Ducats" })).toHaveAttribute("aria-sort", "ascending");
    const firstCell = () => screen.getByRole("row").nth(1).getByRole("cell").first();
    await expect.element(firstCell()).toHaveTextContent("Braton Prime");
    await userEvent.click(screen.getByRole("button", { name: "Ducats" }));
    await expect.element(screen.getByRole("columnheader", { name: "Ducats" })).toHaveAttribute("aria-sort", "descending");
    await expect.element(firstCell()).toHaveTextContent("Corinth Prime");
  });

  it("virtualizes 5000 rows: few rows in the DOM, the last one reachable by scrolling", async () => {
    const data: Item[] = Array.from({ length: 5000 }, (_, i) => ({ id: String(i), name: `Item ${String(i + 1)}`, ducats: i }));
    const screen = await render(<Table label="Many items" columns={COLUMNS} data={data} getRowId={(r) => r.id} className="h-96" />);
    const table = screen.container.querySelector("table");
    expect(table?.querySelectorAll("tbody tr").length).toBeLessThan(80);
    expect(table?.getAttribute("aria-rowcount")).toBe("5001");
    const scroller = screen.container.querySelector("table")?.parentElement;
    scroller?.scrollTo({ top: scroller.scrollHeight });
    await expect.element(page.getByText("Item 5000", { exact: true })).toBeVisible();
  });

  it("shows the empty state", async () => {
    const screen = await render(<Table label="Empty" columns={COLUMNS} data={[]} getRowId={(r) => r.id} empty="Nothing found" />);
    await expect.element(screen.getByText("Nothing found")).toBeVisible();
  });
});
