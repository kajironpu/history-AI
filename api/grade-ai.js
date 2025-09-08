// api/grade-ai.js
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';

export default async function handler(req, res) {
    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエストに対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userAnswer, currentQuestion } = req.body;
        
        // GitHub PATを環境変数から取得
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error("エラー: GITHUB_TOKENが設定されていません。");
            return res.status(500).json({ error: "サーバー設定エラー" });
        }

        // GitHub Models APIクライアントの初期化
        const client = ModelClient(
            "https://models.github.ai/inference",
            new AzureKeyCredential(token),
        );
        const modelName = "microsoft/Phi-4";

        const prompt = `あなたは歴史クイズの先生です。中学生が相手なので、丁寧で分かりやすい言葉で回答してください。以下の情報をもとに、採点結果と解説を教えてください。
---
## 採点ルール
- 回答が正しければ、「✔ 正解！」と答えて、その用語の簡単な説明と背景を教えてください。
- 回答が間違っていても、「❌ 不正解」と答えるだけでなく、なぜ間違っているのか、正しい答えとその言葉が生まれた時代や出来事の背景を分かりやすく説明してください。
- 回答が空欄でも、問題の答えと解説をしてください。
## 採点対象
- あなたの回答: ${userAnswer}
- 期待される正答: ${currentQuestion.answer}
- 問題文: ${currentQuestion.question}
---
`;

        const response = await client.path("/chat/completions").post({
            body: {
                messages: [{ role: "user", content: prompt }],
                model: modelName,
                temperature: 0.7
            }
        });

        if (isUnexpected(response)) {
            console.error("APIエラー:", response.body.error);
            return res.status(response.status).json({ error: response.body.error });
        }

        const outputText = response.body.choices[0]?.message?.content || "No response";
        res.json({ advice: outputText });

    } catch (error) {
        console.error("サーバーでのAI採点エラー:", error);
        res.status(500).json({ error: "サーバーでの採点中にエラーが発生しました。" });
    }
}