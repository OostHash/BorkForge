import { useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "../../primitives/navigation";
import { AnalyzerTab } from "./AnalyzerTab";
import { MyRivensTab } from "./MyRivensTab";

type View = "analyzer" | "owned";

/**
 * Rivens: the analyzer (current Rivens module) and the rivens you own (the
 * former Market → Rivens tab). The overlay window comes with the Overlays port.
 */
export function RivensScreen() {
  const [view, setView] = useState<View>("analyzer");
  return (
    <Tabs selectedKey={view} onSelectionChange={setView} className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="border-b border-border px-4 pt-2 lg:px-6">
        <TabList label="Rivens" className="border-b-0">
          <Tab id="analyzer">Analyzer</Tab>
          <Tab id="owned">My rivens</Tab>
        </TabList>
      </div>
      <TabPanel id="analyzer" className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <AnalyzerTab />
      </TabPanel>
      <TabPanel id="owned" className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <MyRivensTab />
      </TabPanel>
    </Tabs>
  );
}
