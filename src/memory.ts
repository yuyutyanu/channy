import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// プロジェクトルートの data/ に保存
const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../");
const MEMORY_DIR = path.join(PROJECT_ROOT, "data");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.md");   // 永続メモ（手動編集可・コミット可）
const HISTORY_FILE = path.join(MEMORY_DIR, "history.jsonl"); // 会話ログ（gitignore 推奨）

const MAX_HISTORY = 50;  // history.jsonl に保持する最大ターン数
const PROMPT_TURNS = 10; // system prompt に含める直近ターン数

interface Turn {
    ts: string;   // ISO 8601
    user: string;
    agent: string;
}

/**
 * 起動時初期化。
 * ディレクトリと memory.md のデフォルトファイルを作成する。
 */
export function initMemory(): void {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });

    if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(
            MEMORY_FILE,
            [
                "# Memory",
                "",
                "<!-- このファイルはエージェントの永続メモです。自由に編集できます。 -->",
                "<!-- 記憶させたいことを自由に書いてください。エージェントへの指示として使えます。 -->",
                "<!-- エージェントは起動時にこの内容を読み込み、指示として扱います。 -->",
                "",
            ].join("\n"),
            "utf-8"
        );
        console.log(`📝 Memory file created: ${MEMORY_FILE}`);
    }
}

/**
 * 会話ターンを history.jsonl に追記。
 * MAX_HISTORY を超えたら古いエントリを切り捨てる。
 */
export function saveMemory(user: string, agent: string): void {
    const turn: Turn = { ts: new Date().toISOString(), user, agent };
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(turn) + "\n", "utf-8");

    // 行数チェックして超えていたら切り捨て
    const turns = readHistory();
    if (turns.length > MAX_HISTORY) {
        const trimmed = turns.slice(-MAX_HISTORY);
        fs.writeFileSync(
            HISTORY_FILE,
            trimmed.map((t) => JSON.stringify(t)).join("\n") + "\n",
            "utf-8"
        );
    }
}

/**
 * システムプロンプト用の文字列を返す。
 * - memory.md の内容（永続メモ）
 * - 直近 PROMPT_TURNS ターンの会話履歴
 */
export function loadMemoryPrompt(): string {
    const sections: string[] = [];

    // 1. 永続メモ（memory.md）― コメント行と空行のみなら省略
    if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
        const meaningful = raw
            .split("\n")
            .filter((l) => !l.startsWith("<!--") && l.trim() !== "" && l.trim() !== "# Memory")
            .join("\n")
            .trim();
        if (meaningful) {
            sections.push(raw.trim());
        }
    }

    // 2. 直近の会話履歴
    const turns = readHistory().slice(-PROMPT_TURNS);
    if (turns.length > 0) {
        const lines = turns
            .map((t) => {
                const date = new Date(t.ts).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                return `[${date}]\nUser: ${t.user}\nAssistant: ${t.agent}`;
            })
            .join("\n\n");
        sections.push(`# 会話履歴（直近 ${turns.length} ターン）\n\n${lines}`);
    }

    return sections.join("\n\n---\n\n");
}

function readHistory(): Turn[] {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    return fs
        .readFileSync(HISTORY_FILE, "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Turn);
}
