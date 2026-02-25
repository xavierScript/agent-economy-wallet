#!/usr/bin/env node

/**
 * @agentic-wallet/cli
 *
 * Ink-based TUI for observing Solana agentic wallet actions in real-time.
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

const services = createServices();

render(createElement(App, { services }));
