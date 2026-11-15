import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, expect, it } from "vitest";
import { logInGameTrade } from "./trading";

afterEach(() => {
  clearMocks();
});

it("writes every row of an in-game trade in order, even after a failed row", async () => {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  let first = true;
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "add_trade" && first) {
      first = false;
      throw new Error("db busy");
    }
    return null;
  });
  await logInGameTrade({
    withPlayer: "Tenno",
    tradeType: "trade",
    offeredItems: [{ name: "A", qty: 1 }],
    receivedItems: [{ name: "B", qty: 2 }],
    sessionId: "s1",
  });
  const rows = calls.filter((c) => c.cmd === "add_trade").map((c) => (c.args as { params: { direction: string; itemName: string } }).params);
  expect(rows.map((r) => [r.direction, r.itemName])).toEqual([
    ["traded-out", "A"],
    ["traded-in", "B"],
  ]);
  expect(calls.at(-1)?.cmd).toBe("plugin:event|emit");
});
