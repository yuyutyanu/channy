#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src", "index.ts");
const envFile = path.join(root, ".env");

// node に tsx/esm を ESM ローダーとして渡す（.cmd 不要・shell 不要）
const proc = spawn(
    process.execPath,
    ["--import", "tsx/esm", `--env-file=${envFile}`, entry],
    { stdio: "inherit", cwd: root }
);

proc.on("exit", (code) => process.exit(code ?? 0));
