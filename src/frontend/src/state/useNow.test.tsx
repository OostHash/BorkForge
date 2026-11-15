import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useMinuteNow } from "./useNow";

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

it("ticks the minute clock on the minute, not every second", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T12:00:30Z"));
  let renders = 0;
  function Probe() {
    renders += 1;
    const now = useMinuteNow();
    return <span>{new Date(now).toISOString()}</span>;
  }
  await render(<Probe />);
  const first = renders;
  await vi.advanceTimersByTimeAsync(29_000);
  expect(renders).toBe(first);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(renders).toBe(first + 1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(renders).toBe(first + 2);
});
