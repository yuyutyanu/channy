import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { globSync } from "fs";

const readFileTool = createTool({
    id: "read_file",
    description: "ファイルを読み込んで内容を返す",
    inputSchema: z.object({
        file_path: z.string().describe("読み込むファイルのパス"),
        offset: z.number().optional().describe("読み込み開始行（1始まり）"),
        limit: z.number().optional().describe("読み込む最大行数"),
    }),
    execute: async ({ context }) => {
        try {
            const content = fs.readFileSync(context.file_path, "utf-8");
            const lines = content.split("\n");
            const start = context.offset ? context.offset - 1 : 0;
            const slice = context.limit
                ? lines.slice(start, start + context.limit)
                : lines.slice(start);
            return { content: slice.join("\n"), total_lines: lines.length };
        } catch (e: any) {
            return { error: e.message };
        }
    },
});

const writeFileTool = createTool({
    id: "write_file",
    description: "ファイルを作成または上書きする",
    inputSchema: z.object({
        file_path: z.string().describe("書き込むファイルのパス"),
        content: z.string().describe("書き込む内容"),
    }),
    execute: async ({ context }) => {
        try {
            const dir = path.dirname(context.file_path);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(context.file_path, context.content, "utf-8");
            return { success: true, file_path: context.file_path };
        } catch (e: any) {
            return { error: e.message };
        }
    },
});

const editFileTool = createTool({
    id: "edit_file",
    description: "ファイル内の文字列を置換する（完全一致で1箇所のみ）",
    inputSchema: z.object({
        file_path: z.string().describe("編集するファイルのパス"),
        old_string: z.string().describe("置換対象の文字列（完全一致）"),
        new_string: z.string().describe("置換後の文字列"),
    }),
    execute: async ({ context }) => {
        try {
            const content = fs.readFileSync(context.file_path, "utf-8");
            if (!content.includes(context.old_string)) {
                return { error: "old_string がファイル内に見つかりません" };
            }
            const updated = content.replace(
                context.old_string,
                context.new_string,
            );
            fs.writeFileSync(context.file_path, updated, "utf-8");
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    },
});

const globFilesTool = createTool({
    id: "glob_files",
    description: "glob パターンでファイルを検索する（例: **/*.ts）",
    inputSchema: z.object({
        pattern: z.string().describe("glob パターン（例: src/**/*.ts）"),
        cwd: z
            .string()
            .optional()
            .describe("検索のベースディレクトリ（省略時はカレント）"),
    }),
    execute: async ({ context }) => {
        try {
            const matches = globSync(context.pattern, {
                cwd: context.cwd ?? process.cwd(),
            }).filter((m) => {
                const full = path.join(
                    context.cwd ?? process.cwd(),
                    m as string,
                );
                return fs.statSync(full).isFile();
            });
            return { files: matches, count: matches.length };
        } catch (e: any) {
            return { error: e.message };
        }
    },
});

const grepFilesTool = createTool({
    id: "grep_files",
    description:
        "ファイルまたはディレクトリ内のテキストをキーワード・正規表現で検索する",
    inputSchema: z.object({
        pattern: z.string().describe("検索する文字列または正規表現"),
        path: z.string().describe("検索対象のファイルまたはディレクトリのパス"),
        recursive: z
            .boolean()
            .optional()
            .describe("ディレクトリを再帰的に検索するか（デフォルト: true）"),
        case_sensitive: z
            .boolean()
            .optional()
            .describe("大文字小文字を区別するか（デフォルト: false）"),
    }),
    execute: async ({ context }) => {
        try {
            const regex = new RegExp(
                context.pattern,
                context.case_sensitive ? "g" : "gi",
            );
            const recursive = context.recursive ?? true;
            const results: { file: string; line: number; text: string }[] = [];

            function searchFile(filePath: string) {
                try {
                    const content = fs.readFileSync(filePath, "utf-8");
                    content.split("\n").forEach((line, idx) => {
                        if (regex.test(line)) {
                            results.push({
                                file: filePath,
                                line: idx + 1,
                                text: line.trim(),
                            });
                        }
                        regex.lastIndex = 0;
                    });
                } catch {
                    // バイナリ等は無視
                }
            }

            function walk(dirPath: string) {
                const entries = fs.readdirSync(dirPath, {
                    withFileTypes: true,
                });
                for (const entry of entries) {
                    const full = path.join(dirPath, entry.name);
                    if (entry.isDirectory() && recursive) {
                        if (
                            !entry.name.startsWith(".") &&
                            entry.name !== "node_modules"
                        ) {
                            walk(full);
                        }
                    } else if (entry.isFile()) {
                        searchFile(full);
                    }
                }
            }

            const stat = fs.statSync(context.path);
            if (stat.isDirectory()) {
                walk(context.path);
            } else {
                searchFile(context.path);
            }

            return { matches: results.slice(0, 100), total: results.length };
        } catch (e: any) {
            return { error: e.message };
        }
    },
});

export const toolNames = [
    "read_file",
    "write_file",
    "edit_file",
    "glob_files",
    "grep_files",
];
export const tools = [
    readFileTool,
    writeFileTool,
    editFileTool,
    globFilesTool,
    grepFilesTool,
];
