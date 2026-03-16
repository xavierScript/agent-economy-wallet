#!/usr/bin/env node

/**
 * @agent-economy-wallet/cli
 *
 * Ink-based TUI for observing Solana agent economy wallet actions in real-time.
 * Displays wallets, balances, and audit activity with auto-refresh.
 *
 * Keyboard:
 *   1  Dashboard    2  Wallets    3  Logs
 *   r  Refresh      q  Quit
 */

import { render } from "ink";
import { createElement } from "react";
import { App } from "./app.js";
import { createServices } from "./services.js";

const enterAltScreen = () => process.stdout.write("\x1b[?1049h");
const leaveAltScreen = () => process.stdout.write("\x1b[?1049l");

enterAltScreen();
const services = createServices();

const { waitUntilExit } = render(createElement(App, { services }));

waitUntilExit()
  .then(() => {
    leaveAltScreen();
  })
  .catch(() => {
    leaveAltScreen();
  });

process.on("SIGINT", () => {
  leaveAltScreen();
  process.exit(0);
});
process.on("SIGTERM", () => {
  leaveAltScreen();
  process.exit(0);
});
