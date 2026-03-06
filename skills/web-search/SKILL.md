---
name: web-search
description: Webを検索して最新情報を取得する。「〜を調べて」「最新の〜は？」と言われたときに使う。
emoji: 🔍
requires:
  env: [TAVILY_API_KEY]
---

## Overview
Tavily APIを使ってWebを検索し、最新情報を取得する。

## When to Use
- 「〜を調べて」「〜について教えて」と言われたとき
- 最新ニュースや現在の情報が必要なとき
- 自分の知識だけでは答えられないとき

## How to Use
`search_web` ツールに検索クエリを渡す。
- クエリは日本語でも英語でもOK
- 結果は上位3件を要約して、出典URLとともに返す
- 情報の日付にも注意し、古い情報は古いと明示する