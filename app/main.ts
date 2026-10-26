import { createInterface } from "readline";
import { tokenize } from "./tokenize";
import { getShellVariable, runBuiltin } from "./builtin";
import { parseRedirection } from "./redirect";
import { closeSync, openSync, writeSync } from "node:fs";
import { executeExternal, executePipeline } from "./execute";
import { completeCommand } from "./autocomplete";
import { addBackgroundJob, displayJobs } from "./jobs";
import {
  addHistoryEntry,
  appendHistoryFile,
  readHistoryFile,
} from "./history";

const historyFile = process.env.HISTFILE;

if (historyFile) {
  try {
    readHistoryFile(historyFile);
  } catch {
    // Start with empty history when HISTFILE cannot be read.
  }
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
  completer: completeCommand,
  historySize: 1000,
  removeHistoryDuplicates: false,
});

function showPrompt(): void {
  displayJobs((text) => process.stdout.write(text), false);
  rl.prompt();
}

showPrompt();

rl.on("line", async (line) => {
  addHistoryEntry(line);

  const tokens = tokenize(line, getShellVariable);
  const background = tokens[tokens.length - 1] === "&";

  if (background) {
    tokens.pop();
  }

  const pipeIndex = tokens.indexOf("|");

  if (pipeIndex !== -1) {
    const stages: string[][] = [[]];

    for (const token of tokens) {
      if (token === "|") {
        stages.push([]);
      } else {
        stages[stages.length - 1].push(token);
      }
    }

    await executePipeline(
      stages.map(([command, ...args]) => ({ command, args })),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    showPrompt();
    return;
  }

  const parsed = parseRedirection(tokens);

  if (parsed.command === "jobs") {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  let outputFd: number | undefined;
  let errorFd: number | undefined;

  if (parsed.outputPath) {
    outputFd = openSync(parsed.outputPath, parsed.outputAppend ? "a" : "w");
  }

  if (parsed.errorPath) {
    errorFd = openSync(parsed.errorPath, parsed.errorAppend ? "a" : "w");
  }

  const writeOutput = (text: string) => {
    if (outputFd !== undefined) {
      writeSync(outputFd, text);
    } else {
      process.stdout.write(text);
    }
  };

  const builtinResult = runBuiltin(parsed.command, parsed.args, writeOutput);

  if (builtinResult === "exit") {
    if (historyFile) {
      appendHistoryFile(historyFile);
    }

    if (outputFd !== undefined) {
      closeSync(outputFd);
    }

    if (errorFd !== undefined) {
      closeSync(errorFd);
    }

    rl.close();
    return;
  }

  if (!builtinResult) {
    const child = executeExternal(
      parsed.command,
      parsed.args,
      outputFd,
      errorFd,
      background,
    );

    if (background && child?.pid !== undefined) {
      const job = addBackgroundJob(child, line.trim());
      console.log(`[${job.jobNumber}] ${job.pid}`);
    }
  }

  if (outputFd !== undefined) {
    closeSync(outputFd);
  }

  if (errorFd !== undefined) {
    closeSync(errorFd);
  }

  await new Promise<void>((resolve) => setImmediate(resolve));
  showPrompt();
});
