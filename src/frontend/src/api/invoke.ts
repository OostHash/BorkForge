import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { CommandArgs, CommandName, CommandResult } from "./commands";

/** Typed wrapper around Tauri's invoke. The only place the app calls IPC. */
export function invoke<C extends CommandName>(
  command: C,
  ...args: CommandArgs<C> extends undefined ? [] : [CommandArgs<C>]
): Promise<CommandResult<C>> {
  return tauriInvoke<CommandResult<C>>(command, args[0]);
}
