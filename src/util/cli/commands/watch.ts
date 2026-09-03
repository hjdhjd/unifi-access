/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * watch.ts: `ufa watch <events|raw|state>` - the streaming command group over the client's realtime rails.
 */
import { commandList, groupCommand } from "../shared.ts";
import type { CommandSpec } from "../shared.ts";
import { watchEvents } from "./watch-events.ts";
import { watchRaw } from "./watch-raw.ts";
import { watchState } from "./watch-state.ts";

// The watch subcommand table. The dispatcher, the usage text, and the unknown-subcommand diagnostic all derive from it through the shared group composer.
const SUBCOMMANDS: Record<string, CommandSpec> = {

  events: watchEvents,
  raw: watchRaw,
  state: watchState
};

const USAGE = [

  "Usage: ufa watch <subcommand> [options]",
  "",
  "Subcommands:",
  ...commandList(SUBCOMMANDS),
  "",
  "Every watch command streams until Ctrl-C, or until its --count or --duration bound is reached, whichever fires first.",
  "",
  "Run \"ufa watch <subcommand> --help\" for subcommand options."
].join("\n");

/** `ufa watch`. The streaming command group, composed through the shared group dispatcher. */
export const watch: CommandSpec = groupCommand({ commands: SUBCOMMANDS, group: "watch", summary: "Stream events, raw packets, or door state as they happen.",
  usage: USAGE });
