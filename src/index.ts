import readline from "readline";
import { createAgent } from "./agent.js";
import { initMemory, saveMemory } from "./memory.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(label = "考え中"): NodeJS.Timeout {
    let i = 0;
    process.stdout.write(`${SPINNER_FRAMES[0]} ${label}...`);
    return setInterval(() => {
        process.stdout.write(
            `\r${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]} ${label}...`,
        );
    }, 80);
}

function stopSpinner(timer: NodeJS.Timeout): void {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K"); // 行をクリア
}

async function main() {
    initMemory();

    console.log("🤖 Agent Harness 起動中...");
    const agent = await createAgent();
    console.log('✨ 準備完了。"exit" で終了。\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    // Ctrl+C で graceful shutdown
    rl.on("SIGINT", () => {
        console.log("\n👋 終了します。");
        rl.close();
        process.exit(0);
    });

    // セッション内の会話履歴（LLM に渡す messages 配列）
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    const ask = () => {
        rl.question("You: ", async (input) => {
            input = input.trim();
            if (!input) return ask();
            if (input === "exit") {
                console.log("👋 終了します。");
                rl.close();
                return;
            }

            messages.push({ role: "user", content: input });

            try {
                const spinner = startSpinner();
                const result = await agent.generate(messages, { maxSteps: 10 });
                stopSpinner(spinner);
                const text = result.text ?? "(応答なし)";
                console.log(`\nAgent: ${text}\n`);
                messages.push({ role: "assistant", content: text });
                saveMemory(input, text);
            } catch (e) {
                console.error("❌ Error:", e);
                // 失敗したターンは履歴から除去してリトライ可能にする
                messages.pop();
            }

            ask();
        });
    };

    ask();
}

main();
