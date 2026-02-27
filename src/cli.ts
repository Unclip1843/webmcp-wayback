#!/usr/bin/env node

import { startServer } from "./server.js";
import { resolve } from "node:path";

const args = process.argv.slice(2);

function getFlag(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

if (args[0] === "serve" || args.length === 0) {
  const port = parseInt(getFlag("port", "3200"), 10);
  const dataDir = resolve(getFlag("data-dir", ".webmcp"));

  startServer({ port, dataDir });
} else if (args[0] === "--help" || args[0] === "-h") {
  console.log(`webmcp-wayback — Wayback Machine UI for site capability maps

Usage:
  webmcp-wayback serve [options]

Options:
  --port <number>      Port to listen on (default: 3200)
  --data-dir <path>    Path to .webmcp data directory (default: .webmcp)
  --help, -h           Show this help
`);
} else {
  console.error(`Unknown command: ${args[0]}`);
  process.exit(1);
}
