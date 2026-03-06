# channy-ai

Mastraベースの個人用AIエージェントハーネス。SKILL.mdでスキルを宣言的に管理します。

## セットアップ

```bash
npm install
cp .env.example .env   # .env に APIキーを設定
npm link               # channy コマンドをグローバルに登録
```

## 起動

```bash
channy
# または
npm start
```

## スキルの追加方法

`skills/` 以下にディレクトリを作って `SKILL.md` を置くだけで自動認識されます。

```
skills/
└── my-skill/
    ├── SKILL.md   # 必須：自然言語の指示書
    └── tool.ts    # 任意：ツール実装（なければ指示のみ）
```

### SKILL.md フォーマット

```markdown
---
name: my-skill
description: このスキルをいつ使うかの説明（エージェントのトリガーになる）
emoji: 🔧
requires:
  env: [MY_API_KEY]    # 必要な環境変数
  bins: [ffmpeg]       # 必要な外部コマンド（任意）
---

## Overview
スキルの概要

## When to Use
- どんなときに使うか

## How to Use
ツールの使い方や注意点
```

### tool.ts フォーマット

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const toolName = "my_tool";   // ← エクスポート必須

export const tool = createTool({
  id: "my_tool",
  description: "ツールの説明",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ context }) => {
    return { result: "..." };
  },
});
```

## ファイル構成

```
channy-ai/
├── src/
│   ├── index.ts         # CLIエントリーポイント（REPL）
│   ├── agent.ts         # Mastraエージェント定義・Ollama自動起動
│   ├── skill-loader.ts  # SKILL.mdを読んでプロンプト注入
│   └── memory.ts        # 会話履歴の永続化
├── skills/
│   └── web-search/      # サンプルスキル
├── data/
│   ├── memory.md        # 永続メモ（手動編集可・コミット可）
│   └── history.jsonl    # 会話ログ（gitignore済み）
└── bin/
    └── channy.mjs       # グローバルコマンドのエントリーポイント
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `TAVILY_API_KEY` | Web検索用（web-searchスキル） | web-searchを使う場合 |

## 永続メモ

`data/memory.md` を編集すると、エージェントへの永続的な指示として機能します。
起動時に自動でシステムプロンプトへ注入されます。
