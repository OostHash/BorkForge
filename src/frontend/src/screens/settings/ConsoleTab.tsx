import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useConsoleEntries } from "../../api/console";
import {
  CONSOLE_LEVELS,
  DEFAULT_FILTER,
  LEVEL_LABELS,
  clockTime,
  consoleLevel,
  entryLine,
  filterEntries,
  repeatText,
  sourcesOf,
  type ConsoleFilter,
  type ConsoleLevel,
  type LogEntry,
} from "../../domain/console";
import { Button } from "../../primitives/actions";
import { Badge, Icon } from "../../primitives/display";
import type { Tone } from "../../primitives/display/tone";
import { Checkbox, SearchInput, Select } from "../../primitives/forms";
import { ExportDiagnosticsButtons, useDiagnosticsExport } from "./ExportDiagnostics";
import { ResultText, SettingsGroup } from "./parts";

/** Rendering every one of 2000 rows is slow; the newest are what matters. */
const MAX_SHOWN = 500;

const LEVEL_TONE: Record<ConsoleLevel, Tone> = { error: "danger", warn: "warning", info: "info", debug: "neutral" };
const LEVEL_BADGE: Record<ConsoleLevel, string> = { error: "Error", warn: "Warning", info: "Info", debug: "Debug" };

const copy = (text: string) => {
  void navigator.clipboard.writeText(text).catch(() => undefined);
};

/** One entry: a readable line, with fields, causes and the code behind a click. */
function EntryRow({ entry, onOp }: { entry: LogEntry; onOp: (op: number) => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const level = consoleLevel(entry.level);
  const fields = Object.entries(entry.fields);
  const hasDetails = fields.length > 0 || entry.causes.length > 0 || entry.code !== null;
  const message = entry.repeat ? `${entry.message} ${repeatText(entry.repeat)}` : entry.message;
  return (
    <li className="flex flex-col gap-1 py-1.5">
      <div className="flex items-start gap-2 text-sm">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-start disabled:cursor-default"
          aria-expanded={hasDetails ? open : undefined}
          aria-controls={hasDetails ? detailsId : undefined}
          disabled={!hasDetails}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          <Icon icon={open ? ChevronDown : ChevronRight} size="sm" className={hasDetails ? "mt-0.5 text-muted" : "invisible"} />
          <time dateTime={entry.time} className="shrink-0 font-mono text-xs leading-5 text-muted">
            {clockTime(entry.time)}
          </time>
          <Badge tone={LEVEL_TONE[level]}>{LEVEL_BADGE[level]}</Badge>
          <span className="shrink-0 text-xs leading-5 text-muted">{entry.source}</span>
          <span className="min-w-0 break-words">{message}</span>
        </button>
        {entry.op !== null && (
          <button
            type="button"
            className="shrink-0 font-mono text-xs leading-5 text-accent hover:underline"
            aria-label={`Show only operation #${String(entry.op)}`}
            onClick={() => {
              onOp(entry.op ?? 0);
            }}
          >
            #{entry.op}
          </button>
        )}
      </div>
      {open && hasDetails && (
        <div id={detailsId} className="ms-6 flex flex-col gap-1 rounded-md bg-surface-raised p-2 text-xs">
          {entry.code !== null && (
            <p>
              <span className="text-muted">Code </span>
              <code>{entry.code}</code>
            </p>
          )}
          {fields.length > 0 && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
              {fields.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{key}</dt>
                  <dd className="font-mono break-all">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {entry.causes.map((cause, i) => (
            <p key={i}>
              <span className="text-muted">Caused by </span>
              <span className="font-mono break-all">{cause}</span>
            </p>
          ))}
          <div>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={Copy}
              onClick={() => {
                copy(entryLine(entry));
              }}
            >
              Copy line
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Level checkboxes, source, operation and search. */
function Filters({ filter, sources, onChange }: { filter: ConsoleFilter; sources: string[]; onChange: (f: ConsoleFilter) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="sr-only">Levels</legend>
        {CONSOLE_LEVELS.map((level) => (
          <Checkbox
            key={level}
            checked={filter.levels.has(level)}
            onCheckedChange={(on) => {
              const levels = new Set(filter.levels);
              if (on) levels.add(level);
              else levels.delete(level);
              onChange({ ...filter, levels });
            }}
          >
            {LEVEL_LABELS[level]}
          </Checkbox>
        ))}
      </fieldset>
      <Select
        size="sm"
        aria-label="Source"
        value={filter.source ?? ""}
        onChange={(event) => {
          onChange({ ...filter, source: event.target.value === "" ? null : event.target.value });
        }}
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <SearchInput
        size="sm"
        label="Search the log"
        placeholder="Search"
        className="min-w-40 flex-1"
        value={filter.text}
        onValueChange={(text) => {
          onChange({ ...filter, text });
        }}
      />
      {filter.op !== null && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            onChange({ ...filter, op: null });
          }}
        >
          Operation #{filter.op} ✕
        </Button>
      )}
    </div>
  );
}

/** Live background activity (#3): what HexDesk does and why something failed. */
export function ConsoleTab() {
  const entries = useConsoleEntries();
  const [filter, setFilter] = useState<ConsoleFilter>(DEFAULT_FILTER);
  const exporting = useDiagnosticsExport();
  const sources = useMemo(() => sourcesOf(entries), [entries]);
  const shown = useMemo(() => filterEntries(entries, filter), [entries, filter]);
  const newestFirst = useMemo(() => shown.slice(-MAX_SHOWN).reverse(), [shown]);

  return (
    <>
      <SettingsGroup title="Activity">
        <div className="flex flex-col gap-3">
          <Filters filter={filter} sources={sources} onChange={setFilter} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {shown.length === entries.length ? `${String(entries.length)} entries` : `${String(shown.length)} of ${String(entries.length)} entries`}
              {shown.length > MAX_SHOWN && `, newest ${String(MAX_SHOWN)} shown`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={Copy}
                disabled={shown.length === 0}
                onClick={() => {
                  copy(shown.map(entryLine).join("\n"));
                }}
              >
                Copy shown
              </Button>
              <ExportDiagnosticsButtons state={exporting} />
            </div>
          </div>
          {exporting.result && <ResultText tone={exporting.result.tone}>{exporting.result.text}</ResultText>}
        </div>
        {newestFirst.length === 0 ? (
          <p className="text-sm text-muted">{entries.length === 0 ? "Nothing logged yet." : "No entries match these filters."}</p>
        ) : (
          <ol aria-label="Log entries" className="flex flex-col divide-y divide-border">
            {newestFirst.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onOp={(op) => {
                  setFilter((f) => ({ ...f, op, levels: new Set(CONSOLE_LEVELS) }));
                }}
              />
            ))}
          </ol>
        )}
      </SettingsGroup>
    </>
  );
}
