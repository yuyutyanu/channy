import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const toolName = "search_web";

export const tool = createTool({
    id: "search_web",
    description: "Webを検索して最新情報を取得する",
    inputSchema: z.object({
        query: z.string().describe("検索クエリ"),
    }),
    execute: async ({ context }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return { error: "TAVILY_API_KEY が設定されていません" };

        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: context.query,
                api_key: apiKey,
                max_results: 3,
            }),
        });

        const data = await res.json();
        return {
            results: data.results?.map((r: any) => ({
                title: r.title,
                url: r.url,
                content: r.content?.slice(0, 300),
            })),
        };
    },
});