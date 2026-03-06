import { Agent } from "@mastra/core/agent";
import { ollama } from "ollama-ai-provider";
import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
import { SkillLoader } from "./skill-loader.js";
import { loadMemoryPrompt } from "./memory.js";

// import.meta.url ベースで絶対パスを解決（CWD 非依存）
const SKILLS_DIR = path.resolve(fileURLToPath(import.meta.url), "../../skills");
const OLLAMA_URL = "http://localhost:11434";

async function isOllamaRunning(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, {
            signal: AbortSignal.timeout(1000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// 自動起動した場合のみ保持（元から起動済みなら null のまま）
let ollamaProc: ReturnType<typeof spawn> | null = null;

async function ensureOllama(): Promise<void> {
    if (await isOllamaRunning()) return;

    console.log("🦙 Ollama が起動していません。自動起動します...");

    ollamaProc = spawn("ollama", ["serve"], {
        stdio: "ignore",
        shell: process.platform === "win32",
    });

    // ハーネス終了時に Ollama も一緒に落とす
    process.on("exit", () => {
        ollamaProc?.kill();
    });

    // 最大 15 秒待機
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
        if (await isOllamaRunning()) {
            console.log("✅ Ollama 起動完了\n");
            return;
        }
    }

    throw new Error(
        "Ollama の起動がタイムアウトしました。手動で `ollama serve` を実行してください。"
    );
}

export async function createAgent() {
    await ensureOllama();
    const loader = new SkillLoader(SKILLS_DIR);
    loader.listLoaded();

    const tools = await loader.loadTools();
    const skillsPrompt = loader.buildSkillsPrompt();
    const memoryPrompt = loadMemoryPrompt();

    const instructions = [
        "あなたは個人アシスタントです。利用可能なスキルとツールを使ってタスクを解決してください。",
        "わからないことは正直に伝え、推測で答えないでください。",
        memoryPrompt,
        skillsPrompt,
    ]
        .filter(Boolean)
        .join("\n\n");

    return new Agent({
        name: "PersonalAgent",
        instructions,
        model: ollama("qwen3:8b"),
        tools,
    });
}