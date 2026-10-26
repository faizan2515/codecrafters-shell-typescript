import { join } from "node:path";
import { homedir } from "node:os";
import { getExecutablePath } from "./executable";
import { displayJobs } from "./jobs";
import {
  appendHistoryFile,
  getHistoryEntries,
  readHistoryFile,
  writeHistoryFile,
} from "./history";

export const BUILTIN_COMMANDS = [
  "echo",
  "exit",
  "type",
  "pwd",
  "cd",
  "complete",
  "jobs",
  "history",
  "declare",
] as const;

export type BuiltinCommand = (typeof BUILTIN_COMMANDS)[number];

export function isBuiltinCommand(value: string): value is BuiltinCommand {
  return BUILTIN_COMMANDS.includes(value as BuiltinCommand);
}

type BuiltinResult = boolean | "exit";

type WriteOutput = (text: string) => void;

const completionSpecifications = new Map<string, string>();
const shellVariables = new Map<string, string>();

export function getShellVariable(name: string): string | undefined {
  return shellVariables.get(name);
}

export function getCompletionScript(
  command: string,
): string | undefined {
  return completionSpecifications.get(command);
}

export function runBuiltin(
  command: string,
  args: string[],
  writeOutput: WriteOutput,
): BuiltinResult {
  switch (command) {
    case "exit": {
      return "exit";
    }

    case "echo": {
      writeOutput(`${args.join(" ")}\n`);
      return true;
    }

    case "pwd": {
      writeOutput(`${process.cwd()}\n`);
      return true;
    }

    case "cd": {
      const inputPath = args.join(" ");
      let targetPath = inputPath;

      if (inputPath === "~") {
        targetPath = homedir();
      } else if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
        targetPath = join(homedir(), inputPath.slice(2));
      }

      try {
        process.chdir(targetPath);
      } catch {
        console.log(`cd: ${targetPath}: No such file or directory`);
      }
      return true;
    }

    case "complete": {
      if (args[0] === "-r" && args[1]) {
        completionSpecifications.delete(args[1]);
        return true;
      }

      if (args[0] === "-C" && args[1] && args[2]) {
        completionSpecifications.set(args[2], args[1]);
        return true;
      }

      if (args[0] === "-p" && args[1]) {
        const scriptPath = completionSpecifications.get(args[1]);

        if (scriptPath) {
          writeOutput(
            `complete -C '${scriptPath}' ${args[1]}\n`,
          );
        } else {
          writeOutput(
            `complete: ${args[1]}: no completion specification\n`,
          );
        }
      }

      return true;
    }

    case "jobs": {
      displayJobs(writeOutput, true);
      return true;
    }

    case "history": {
      if (args[0] === "-a" && args[1]) {
        appendHistoryFile(args[1]);
        return true;
      }

      if (args[0] === "-w" && args[1]) {
        writeHistoryFile(args[1]);
        return true;
      }

      if (args[0] === "-r" && args[1]) {
        readHistoryFile(args[1]);
        return true;
      }

      const history = getHistoryEntries();
      const requestedCount = args[0] === undefined
        ? history.length
        : Number.parseInt(args[0], 10);
      const count = Number.isNaN(requestedCount)
        ? history.length
        : Math.max(0, requestedCount);
      const firstIndex = Math.max(0, history.length - count);

      for (let index = firstIndex; index < history.length; index++) {
        writeOutput(`${String(index + 1).padStart(5)}  ${history[index]}\n`);
      }
      return true;
    }

    case "declare": {
      if (args[0] === "-p" && args[1]) {
        const value = shellVariables.get(args[1]);

        if (value === undefined) {
          writeOutput(`declare: ${args[1]}: not found\n`);
        } else {
          writeOutput(`declare -- ${args[1]}="${value}"\n`);
        }

        return true;
      }

      const assignment = args[0];
      const separatorIndex = assignment?.indexOf("=") ?? -1;

      if (separatorIndex !== -1) {
        const name = assignment.slice(0, separatorIndex);
        const value = assignment.slice(separatorIndex + 1);

        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          writeOutput(
            `declare: \`${assignment}': not a valid identifier\n`,
          );
          return true;
        }

        shellVariables.set(name, value);
      }

      return true;
    }

    case "type": {
      const name = args.join(" ");

      if (isBuiltinCommand(name)) {
        writeOutput(`${name} is a shell builtin\n`);
      } else {
        const executablePath = getExecutablePath(name);
        writeOutput(
          executablePath
            ? `${name} is ${executablePath}\n`
            : `${name}: not found\n`,
        );
      }
      return true;
    }

    default:
      return false;
  }
}
