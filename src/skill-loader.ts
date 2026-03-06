import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { execSync } from "child_process";
import matter from "gray-matter";
import { z } from "zod";

// zod でスキルメタをバリデーション（DESIGN-2）
const SkillMetaSchema = z.object({
    name: z.string(),
    description: z.string(),
    emoji: z.string().optional(),
    requires: z
        .object({
            env: z.string().array().optional(),
            bins: z.string().array().optional(),
        })
        .optional(),
});

type SkillMeta = z.infer<typeof SkillMetaSchema>;

interface Skill {
    meta: SkillMeta;
    instructions: string;
    dirName: string;
}

export class SkillLoader {
    private skillsDir: string;
    private cache: Skill[] | null = null; // DESIGN-3: ディスク読み取りをキャッシュ

    constructor(skillsDir = "./skills") {
        this.skillsDir = skillsDir;
    }

    // スキルディレクトリを全スキャン（ディレクトリ名のみ返す）
    private listSkillDirs(): string[] {
        if (!fs.existsSync(this.skillsDir)) return [];
        return fs.readdirSync(this.skillsDir).filter((name) => {
            const skillMd = path.join(this.skillsDir, name, "SKILL.md");
            return fs.existsSync(skillMd);
        });
    }

    // SKILL.md をパースしてメタ＋指示文を返す。無効なら null
    private loadSkillSafe(dirName: string): Skill | null {
        try {
            const mdPath = path.join(this.skillsDir, dirName, "SKILL.md");
            const raw = fs.readFileSync(mdPath, "utf-8");
            const { data, content } = matter(raw);
            const result = SkillMetaSchema.safeParse(data);
            if (!result.success) {
                console.warn(
                    `⚠️ Invalid SKILL.md in ${dirName}:`,
                    result.error.flatten().fieldErrors
                );
                return null;
            }
            return { meta: result.data, instructions: content.trim(), dirName };
        } catch (e) {
            console.warn(`⚠️ Failed to load skill ${dirName}:`, e);
            return null;
        }
    }

    // 全スキルをロード（キャッシュ付き）
    private loadSkills(): Skill[] {
        if (this.cache) return this.cache;
        this.cache = this.listSkillDirs()
            .map((d) => this.loadSkillSafe(d))
            .filter((s): s is Skill => s !== null);
        return this.cache;
    }

    // 環境変数とバイナリの存在を検証（DESIGN-1: bins を実装）
    private checkRequirements(skill: Skill): { ok: boolean; missing: string[] } {
        const missing: string[] = [];

        for (const envKey of skill.meta.requires?.env ?? []) {
            if (!process.env[envKey]) missing.push(`env:${envKey}`);
        }

        for (const bin of skill.meta.requires?.bins ?? []) {
            if (!this.binExists(bin)) missing.push(`bin:${bin}`);
        }

        return { ok: missing.length === 0, missing };
    }

    // バイナリの存在確認（Windows: where / その他: which）
    private binExists(bin: string): boolean {
        try {
            const cmd = process.platform === "win32" ? `where ${bin}` : `which ${bin}`;
            execSync(cmd, { stdio: "ignore" });
            return true;
        } catch {
            return false;
        }
    }

    // 全スキルをシステムプロンプト用セクションに変換
    buildSkillsPrompt(): string {
        const skills = this.loadSkills();
        if (skills.length === 0) return "";

        const sections = skills.map((skill) => {
            const { ok, missing } = this.checkRequirements(skill);
            const emoji = skill.meta.emoji ?? "🔧";
            const header = `## ${emoji} ${skill.meta.name}`;
            const body = ok
                ? skill.instructions
                : `${skill.instructions}\n\n> ⚠️ このスキルは設定不足で使えません（未設定: ${missing.join(", ")}）`;
            return `${header}\n\n${body}`;
        });

        return `# Skills\n\n${sections.join("\n\n---\n\n")}`;
    }

    // tool.ts が存在するスキルのツールを動的にインポート
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async loadTools(): Promise<Record<string, any>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: Record<string, any> = {};

        for (const skill of this.loadSkills()) {
            const toolPath = path.resolve(this.skillsDir, skill.dirName, "tool.ts");
            if (fs.existsSync(toolPath)) {
                try {
                    const mod = await import(pathToFileURL(toolPath).href);
                    if (mod.toolName && mod.tool) {
                        tools[mod.toolName as string] = mod.tool;
                        console.log(`✅ Loaded tool: ${mod.toolName}`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to load tool from ${skill.dirName}:`, e);
                }
            }
        }
        return tools;
    }

    // ロード済みスキル一覧を表示
    listLoaded(): void {
        const skills = this.loadSkills();
        console.log(`\n📦 Skills (${skills.length}):`);
        for (const s of skills) {
            const { ok, missing } = this.checkRequirements(s);
            const status = ok ? "✅" : `❌ missing: ${missing.join(", ")}`;
            console.log(`  ${s.meta.emoji ?? "🔧"} ${s.meta.name} — ${status}`);
        }
        console.log();
    }
}
