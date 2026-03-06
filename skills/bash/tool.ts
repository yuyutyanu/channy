import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";

export const toolName = "run_bash";

export const tool = createTool({
    id: "run_bash",
    description:
        "シェルコマンドを実行して stdout/stderr を返す。タイムアウト 30 秒。対話型コマンドは不可。",
    inputSchema: z.object({
        command: z.string().describe("実行するシェルコマンド"),
        cwd: z
            .string()
            .optional()
            .describe("実行ディレクトリ（省略時はカレント）"),
    }),
    execute: async ({ context }) => {
        try {
            const output = execSync(context.command, {
                cwd: context.cwd ?? process.cwd(),
                timeout: 30_000,
                encoding: "utf-8",
                shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
            });
            return { stdout: output, exit_code: 0 };
        } catch (e: any) {
            return {
                stdout: e.stdout ?? "",
                stderr: e.stderr ?? e.message,
                exit_code: e.status ?? 1,
            };
        }
    },
});
