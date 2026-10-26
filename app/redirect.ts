export type ParsedCommand = {
  command: string;
  args: string[];
  outputPath?: string;
  outputAppend?: boolean;
  errorPath?: string;
  errorAppend?: boolean;
};

export function parseRedirection(tokens: string[]): ParsedCommand {
  const command = tokens[0];
  const args = tokens.slice(1);

  const index = args.findIndex(
    (arg) =>
      arg === ">" ||
      arg === "1>" ||
      arg === ">>" ||
      arg === "1>>" ||
      arg === "2>" ||
      arg === "2>>",
  );

  if (index === -1) {
    return { command, args };
  }

  const operator = args[index];
  const filePath = args[index + 1];

  return {
    command,
    args: args.slice(0, index),
    ...(operator === "2>" || operator === "2>>"
      ? {
          errorPath: filePath,
          errorAppend: operator === "2>>",
        }
      : {
          outputPath: filePath,
          outputAppend: operator === ">>" || operator === "1>>",
        }),
  };
}
