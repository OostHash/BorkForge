import { useState } from "react";
import { useOwnership } from "../../api/inventory";
import { useCatalogIndex, usePlatPrices } from "../../api/relics";
import { Tab, TabList, TabPanel, Tabs } from "../../primitives/navigation";
import { PlannerTab } from "./PlannerTab";
import { RelicsTab } from "./RelicsTab";

/** Relics: owned relics with their rewards, and the refinement planner. */
export function RelicsScreen() {
  const [tab, setTab] = useState<"relics" | "planner">("relics");
  const { ownership } = useOwnership();
  const { index } = useCatalogIndex();
  const prices = usePlatPrices();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs selectedKey={tab} onSelectionChange={setTab} className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 border-b border-border bg-bg px-4 pt-2 lg:px-6">
          <TabList label="Relics" className="border-b-0">
            <Tab id="relics">Relics</Tab>
            <Tab id="planner">Planner</Tab>
          </TabList>
        </div>
        {/* Each tab scrolls on its own, under the tab bar. */}
        <TabPanel id="relics" className="flex min-h-0 flex-1 flex-col">
          <RelicsTab index={index} own={ownership} prices={prices} />
        </TabPanel>
        <TabPanel id="planner" className="flex min-h-0 flex-1 flex-col">
          <PlannerTab index={index} own={ownership} prices={prices} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
