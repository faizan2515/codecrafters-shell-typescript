import { accessSync, constants, readdirSync } from "node:fs";
import { delimiter, join } from "node:path";

export function getExecutablePath(args: string) {
  const pathValue = process.env.PATH ?? "";

  const directories = pathValue.split(delimiter);

  let executablePath: string | undefined;

  for (const directory of directories) {
    const candidate = join(directory, args);

    try {
      accessSync(candidate, constants.X_OK);
      executablePath = candidate;
      break;
    } catch {
      // Continue searching
    }
  }

  return executablePath;
}

export function getExecutableCompletions(prefix: string): string[] {
  const pathValue = process.env.PATH ?? "";
  const directories = pathValue.split(delimiter);
  const completions = new Set<string>();

  for (const directory of directories) {
    try {
      for (const entry of readdirSync(directory)) {
        if (!entry.startsWith(prefix)) {
          continue;
        }

        try {
          accessSync(join(directory, entry), constants.X_OK);
          completions.add(entry);
        } catch {
          // Ignore non-executable entries.
        }
      }
    } catch {
      // Ignore missing or unreadable PATH directories.
    }
  }

  return [...completions];
}
