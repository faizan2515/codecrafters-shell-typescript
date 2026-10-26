import {
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import { isBuiltinCommand, runBuiltin } from "./builtin";
import { getExecutablePath } from "./executable";

function waitForProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once("close", () => resolve());
  });
}

async function executeTwoCommandPipeline(
  leftCommand: string,
  leftArgs: string[],
  rightCommand: string,
  rightArgs: string[],
): Promise<void> {
  const leftIsBuiltin = isBuiltinCommand(leftCommand);
  const rightIsBuiltin = isBuiltinCommand(rightCommand);
  const leftPath = leftIsBuiltin
    ? undefined
    : getExecutablePath(leftCommand);
  const rightPath = rightIsBuiltin
    ? undefined
    : getExecutablePath(rightCommand);

  if (!leftIsBuiltin && !leftPath) {
    console.log(`${leftCommand}: command not found`);
    return;
  }

  if (!rightIsBuiltin && !rightPath) {
    console.log(`${rightCommand}: command not found`);
    return;
  }

  if (leftIsBuiltin) {
    let leftOutput = "";
    runBuiltin(leftCommand, leftArgs, (text) => {
      leftOutput += text;
    });

    if (rightIsBuiltin) {
      runBuiltin(rightCommand, rightArgs, (text) => {
        process.stdout.write(text);
      });
      return;
    }

    const right = spawn(rightPath!, rightArgs, {
      stdio: ["pipe", "inherit", "inherit"],
      argv0: rightCommand,
    });

    right.stdin?.end(leftOutput);
    await waitForProcess(right);
    return;
  }

  if (rightIsBuiltin) {
    const left = spawn(leftPath!, leftArgs, {
      stdio: ["inherit", "ignore", "inherit"],
      argv0: leftCommand,
    });

    runBuiltin(rightCommand, rightArgs, (text) => {
      process.stdout.write(text);
    });

    await waitForProcess(left);
    return;
  }

  const left = spawn(leftPath!, leftArgs, {
    stdio: ["inherit", "pipe", "inherit"],
    argv0: leftCommand,
  });
  const right = spawn(rightPath!, rightArgs, {
    stdio: ["pipe", "inherit", "inherit"],
    argv0: rightCommand,
  });

  if (left.stdout && right.stdin) {
    left.stdout.pipe(right.stdin);
  }

  right.stdin?.on("error", () => {
    // The reader may close the pipe early, such as `head -n 5`.
  });
  right.once("close", () => {
    if (left.exitCode === null && left.signalCode === null) {
      left.kill();
    }
  });

  await Promise.all([
    waitForProcess(left),
    waitForProcess(right),
  ]);
}

export type PipelineStage = {
  command: string;
  args: string[];
};

export async function executePipeline(
  stages: PipelineStage[],
): Promise<void> {
  if (
    stages.length === 2 &&
    stages.some((stage) => isBuiltinCommand(stage.command))
  ) {
    await executeTwoCommandPipeline(
      stages[0].command,
      stages[0].args,
      stages[1].command,
      stages[1].args,
    );
    return;
  }

  const executablePaths = stages.map((stage) =>
    getExecutablePath(stage.command),
  );
  const missingIndex = executablePaths.findIndex((path) => !path);

  if (missingIndex !== -1) {
    console.log(`${stages[missingIndex].command}: command not found`);
    return;
  }

  const children = stages.map((stage, index) =>
    spawn(executablePaths[index]!, stage.args, {
      stdio: [
        index === 0 ? "inherit" : "pipe",
        index === stages.length - 1 ? "inherit" : "pipe",
        "inherit",
      ],
      argv0: stage.command,
    }),
  );

  for (let index = 0; index < children.length - 1; index++) {
    const producer = children[index];
    const consumer = children[index + 1];

    if (producer.stdout && consumer.stdin) {
      producer.stdout.pipe(consumer.stdin);
    }

    consumer.stdin?.on("error", () => {
      // A downstream command may close its input early.
    });
    consumer.once("close", () => {
      if (producer.exitCode === null && producer.signalCode === null) {
        producer.kill();
      }
    });
  }

  await Promise.all(children.map(waitForProcess));
}

export function executeExternal(
  command: string,
  args: string[],
  outputFd?: number,
  errorFd?: number,
  background = false,
): ChildProcess | undefined {
  const executablePath = getExecutablePath(command);

  if (!executablePath) {
    console.log(`${command}: command not found`);
    return undefined;
  }

  if (background) {
    const child = spawn(executablePath, args, {
      stdio: [
        "ignore",
        outputFd ?? "inherit",
        errorFd ?? "inherit",
      ],
      argv0: command,
      detached: true,
    });

    child.unref();
    return child;
  }

  spawnSync(executablePath, args, {
    stdio: [
      "inherit",
      outputFd ?? "inherit",
      errorFd ?? "inherit",
    ],
    argv0: command,
  });

  return undefined;
}
