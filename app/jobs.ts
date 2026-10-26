import type { ChildProcess } from "node:child_process";

export type BackgroundJob = {
  jobNumber: number;
  pid: number;
  command: string;
  status: "Running" | "Done";
};

const backgroundJobs: BackgroundJob[] = [];

export function addBackgroundJob(
  child: ChildProcess,
  command: string,
): BackgroundJob {
  if (child.pid === undefined) {
    throw new Error("Background process did not receive a PID");
  }

  const jobNumber = backgroundJobs.reduce(
    (highest, job) => Math.max(highest, job.jobNumber),
    0,
  ) + 1;

  const job: BackgroundJob = {
    jobNumber,
    pid: child.pid,
    command,
    status: "Running",
  };

  child.once("exit", (code) => {
    if (code !== null) {
      job.status = "Done";
    }
  });

  backgroundJobs.push(job);
  return job;
}

function removeDoneJobs(): void {
  for (let index = backgroundJobs.length - 1; index >= 0; index--) {
    if (backgroundJobs[index].status === "Done") {
      backgroundJobs.splice(index, 1);
    }
  }
}

export function displayJobs(
  writeOutput: (text: string) => void,
  includeRunning: boolean,
): void {
  for (const [index, job] of backgroundJobs.entries()) {
    if (!includeRunning && job.status !== "Done") {
      continue;
    }

    const marker =
      index === backgroundJobs.length - 1
        ? "+"
        : index === backgroundJobs.length - 2
          ? "-"
          : " ";
    const command = job.status === "Done"
      ? job.command.replace(/\s*&\s*$/, "")
      : job.command;

    writeOutput(
      `[${job.jobNumber}]${marker}  ${job.status.padEnd(24)}${command}\n`,
    );
  }

  removeDoneJobs();
}
