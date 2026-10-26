import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getCompletionScript } from "./builtin";
import { getExecutableCompletions } from "./executable";

const COMPLETABLE_BUILTINS = ["echo", "exit"];

let previousLine = "";
let previousMatches: string[] = [];

function longestCommonPrefix(values: string[]): string {
  let prefix = values[0] ?? "";

  for (const value of values.slice(1)) {
    let length = 0;

    while (
      length < prefix.length &&
      length < value.length &&
      prefix[length] === value[length]
    ) {
      length++;
    }

    prefix = prefix.slice(0, length);
  }

  return prefix;
}

export function completeCommand(line: string): [string[], string] {
  const words = line.trim().split(/\s+/).filter(Boolean);
  const command = words[0] ?? "";
  const hasTrailingWhitespace = /\s$/.test(line);
  const currentWord = hasTrailingWhitespace
    ? ""
    : words[words.length - 1] ?? "";
  const previousWord = hasTrailingWhitespace
    ? words.length > 2
      ? words[words.length - 1]
      : ""
    : words.length > 1
      ? words[words.length - 2]
      : "";
  const completerScript = getCompletionScript(command);

  if (completerScript && (hasTrailingWhitespace || words.length > 1)) {
    try {
      const candidates = execFileSync(
        completerScript,
        [command, currentWord, previousWord],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            COMP_LINE: line,
            COMP_POINT: String(Buffer.byteLength(line)),
          },
        },
      )
        .trim()
        .split(/\r?\n/)
        .map((candidate) => candidate.trim())
        .filter(Boolean)
        .sort();

      if (candidates.length === 1) {
        previousLine = "";
        previousMatches = [];

        const lineWithoutCurrentWord = line.slice(
          0,
          line.length - currentWord.length,
        );

        return [[`${lineWithoutCurrentWord}${candidates[0]} `], line];
      }

      if (candidates.length > 1) {
        const commonPrefix = longestCommonPrefix(candidates);

        if (commonPrefix.length > currentWord.length) {
          previousLine = "";
          previousMatches = [];

          const lineWithoutCurrentWord = line.slice(
            0,
            line.length - currentWord.length,
          );

          return [[`${lineWithoutCurrentWord}${commonPrefix}`], line];
        }

        const repeatedTab =
          line === previousLine &&
          candidates.length === previousMatches.length &&
          candidates.every(
            (candidate, index) => candidate === previousMatches[index],
          );

        previousLine = line;
        previousMatches = candidates;

        if (repeatedTab) {
          process.stdout.write(
            `\n${candidates.join("  ")}\n$ ${line}`,
          );
          return [[], line];
        }

        process.stdout.write("\x07");
        return [[], line];
      }
    } catch {
      // Fall back to normal completion behavior.
    }
  }

  const lastSpace = Math.max(
    line.lastIndexOf(" "),
    line.lastIndexOf("\t"),
  );

  if (lastSpace !== -1) {
    const partialPath = line.slice(lastSpace + 1);
    const lastSlash = partialPath.lastIndexOf("/");
    const directoryPath =
      lastSlash === -1 ? "" : partialPath.slice(0, lastSlash + 1);
    const filenamePrefix =
      lastSlash === -1 ? partialPath : partialPath.slice(lastSlash + 1);
    let matchingEntries: { name: string; isDirectory: boolean }[] = [];

    try {
      matchingEntries = readdirSync(
        resolve(process.cwd(), directoryPath),
        {
          withFileTypes: true,
        },
      )
        .filter(
          (entry) => entry.name.startsWith(filenamePrefix),
        )
        .map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
    } catch {
      matchingEntries = [];
    }

    if (matchingEntries.length > 1) {
      const commonPrefix = longestCommonPrefix(
        matchingEntries.map((entry) => entry.name),
      );

      if (commonPrefix.length > filenamePrefix.length) {
        previousLine = "";
        previousMatches = [];

        const completedLine =
          `${line.slice(0, lastSpace + 1)}${directoryPath}${commonPrefix}`;

        return [[completedLine], line];
      }

      const displayMatches = matchingEntries
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) =>
          entry.isDirectory ? `${entry.name}/` : entry.name,
        );

      const repeatedTab =
        line === previousLine &&
        displayMatches.length === previousMatches.length &&
        displayMatches.every(
          (match, index) => match === previousMatches[index],
        );

      previousLine = line;
      previousMatches = displayMatches;

      if (repeatedTab) {
        process.stdout.write(
          `\n${displayMatches.join("  ")}\n$ ${line}`,
        );
        return [[], line];
      }

      process.stdout.write("\x07");
      return [[], line];
    }

    previousLine = "";
    previousMatches = [];

    if (matchingEntries.length === 1) {
      const entry = matchingEntries[0];
      const suffix = entry.isDirectory ? `${entry.name}/` : `${entry.name} `;
      const completedLine =
        `${line.slice(0, lastSpace + 1)}${directoryPath}${suffix}`;

      return [[completedLine], line];
    }

    process.stdout.write("\x07");
    return [[], line];
  }

  const builtinCandidates = COMPLETABLE_BUILTINS.filter((command) =>
    command.startsWith(line),
  );

  const executableCandidates = getExecutableCompletions(line);
  const matches = [
    ...new Set([...builtinCandidates, ...executableCandidates]),
  ].sort();

  if (matches.length > 1) {
    const commonPrefix = longestCommonPrefix(matches);

    if (commonPrefix.length > line.length) {
      previousLine = "";
      previousMatches = [];
      return [[commonPrefix], line];
    }

    const repeatedTab =
      line === previousLine &&
      matches.length === previousMatches.length &&
      matches.every((match, index) => match === previousMatches[index]);

    previousLine = line;
    previousMatches = matches;

    if (repeatedTab) {
      process.stdout.write(
        `\n${matches.join("  ")}\n$ ${line}`,
      );
      return [[], line];
    }

    process.stdout.write("\x07");
    return [[], line];
  }

  previousLine = "";
  previousMatches = [];

  const candidates = matches.map((command) => `${command} `);

  if (candidates.length === 0) {
    process.stdout.write("\x07");
  }

  return [candidates, line];
}
