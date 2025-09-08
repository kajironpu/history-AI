// api/grade-ai.js
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';

export default async function handler(req, res) {
    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userAnswer, currentQuestion } = req.body;

        if (!userAnswer || !currentQuestion) {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        // GitHub PATを環境変数から取得
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error("エラー: GITHUB_TOKENが設定されていません。");
            return res.status(500).json({ error: "サーバー設定エラー: 環境変数が設定されていません" });
        }

        // GitHub Models APIクライアントの初期化
        const client = ModelClient(
            "https://models.inference.ai.azure.com",
            new AzureKeyCredential(token),
        );
        const modelName = "gpt-4o-mini";

        const prompt = `あなたは歴史の先生です。中学生が相手なので、丁寧で分かりやすい言葉で回答してください。以下の情報をもとに、採点結果と解説を教えてください。
 - あなたは歴史の先生です。中学生が相手なので、丁寧で分かりやすい言葉で回答してください。
+ 丁寧で分かりやすく解説してください。最後に「質問があれば、何でも聞いてくださいね！」とは言わないこと。
---
## 採点ルール
- 回答が正しければ、「✔ 正解！」と答えて、その用語の簡単な説明と背景を教えてください。また解答はぴったり同じでなくてもいいです。
- 回答が間違っていても、「❌ 不正解です。」と答えるだけでなく、なぜ間違っているのか、正しい答えとその言葉が生まれた時代や出来事の背景を中学生向けに分かりやすく説明してください。
- 回答が空欄でも、問題の答えと解説をしてください。

## 採点対象
- 正しい答え: ${currentQuestion.answer}
- 問題文: ${currentQuestion.question}
---
`;

        const response = await client.path("/chat/completions").post({
            body: {
                messages: [{ role: "user", content: prompt }],
                model: modelName,
                temperature: 0.7,
                max_tokens: 500
            }
        });

        if (isUnexpected(response)) {
            console.error("APIエラー:", response.body.error);
            return res.status(response.status).json({ 
                error: `AI API Error: ${response.body.error?.message || 'Unknown error'}` 
            });
        }

        const outputText = response.body.choices[0]?.message?.content || "AI応答を取得できませんでした";
        res.json({ advice: outputText });

    } catch (error) {
        console.error("サーバーでのAI採点エラー:", error);
        res.status(500).json({ 
            error: `サーバーエラー: ${error.message}`,
            details: "AIサービスとの通信に失敗しました"
        });
    }
}
