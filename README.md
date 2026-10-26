# TypeScript Shell

Completed implementation of the CodeCrafters
[Build Your Own Shell](https://app.codecrafters.io/courses/shell/overview)
challenge, written in TypeScript and executed with Bun.

## Challenge completed

This shell supports the challenge features implemented throughout the course,
including:

- Builtin commands such as `echo`, `exit`, `type`, `pwd`, `cd`, `history`,
  `jobs`, `complete`, and `declare`
- External executable discovery and execution through `PATH`
- Single and double quotes, backslash escaping, and argument tokenization
- Standard output and standard error redirection, including append modes
- Command, executable, filename, directory, and programmable completion
- Background jobs, job tracking, reaping, and recycled job numbers
- Multi-stage pipelines and builtin participation in pipelines
- In-memory and file-backed command history
- Shell variables and `$VAR` / `${VAR}` parameter expansion

## Run locally

Install Bun, then run:

```sh
./your_program.sh
```

On Windows, the TypeScript entry point can also be started directly:

```powershell
bun run app/main.ts
```

## CodeCrafters

[![progress-banner](https://backend.codecrafters.io/progress/shell/ec285be0-3a90-4cc9-8dc2-7897d7f3a4b7)](https://app.codecrafters.io/users/faizan2515?r=2qF)
