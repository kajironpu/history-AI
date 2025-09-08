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

const prompt = `
あなたは歴史の先生です。中学生が相手なので、丁寧で分かりやすく説明してください。
最後に「質問があれば、何でも聞いてくださいね！」とは言わないこと。

---
## 採点ルール
- 回答が正しければ、必ず次のフォーマットで出力してください：

### 採点結果
✔ 正解！

### 解説
{用語の説明と背景を中学生向けに簡単に説明}

- 回答が間違っている場合も、必ず次のフォーマットで出力してください：

### 採点結果
❌ 不正解です。  
○ 正解は {正解の用語} です。

### 解説
{なぜ間違いか、正しい答えと背景を中学生向けに説明}

- 回答が空欄でも間違いと同じ形式で答えてください。

---
## 採点対象
- 正しい答え: ${currentQuestion.answer}
- あなたの回答: ${userAnswer}
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
