import { useEffect, useState } from "react";
import { MAX_ENTRIES, mergeEntries, type LogEntry } from "../domain/console";
import { onEvent } from "./events";
import { invoke } from "./invoke";

/**
 * The activity console's entries: what the backend recorded so far, then every
 * new entry live. Listens before it fetches, so nothing logged in between is
 * missed; `mergeEntries` drops the overlap.
 */
export function useConsoleEntries(): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  useEffect(() => {
    let active = true;
    const unlisten = onEvent("diag-entry", (entry) => {
      if (active) setEntries((current) => mergeEntries(current, [entry]));
    });
    invoke("get_recent_logs", { limit: MAX_ENTRIES })
      .then((recent) => {
        if (active) setEntries((current) => mergeEntries(current, recent));
      })
      // The console stays empty; there is no other place to report this.
      .catch(() => undefined);
    return () => {
      active = false;
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, []);
  return entries;
}
