import {
  appendFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

const commandHistory: string[] = [];
let appendCursor = 0;

export function addHistoryEntry(command: string): void {
  if (command.trim()) {
    commandHistory.push(command);
  }
}

export function getHistoryEntries(): readonly string[] {
  return commandHistory;
}

export function readHistoryFile(path: string): void {
  const contents = readFileSync(path, "utf8");

  for (const command of contents.split(/\r?\n/)) {
    addHistoryEntry(command);
  }

  appendCursor = commandHistory.length;
}

export function writeHistoryFile(path: string): void {
  writeFileSync(path, `${commandHistory.join("\n")}\n`, "utf8");
}

export function appendHistoryFile(path: string): void {
  const newEntries = commandHistory.slice(appendCursor);

  if (newEntries.length > 0) {
    appendFileSync(path, `${newEntries.join("\n")}\n`, "utf8");
  }

  appendCursor = commandHistory.length;
}
