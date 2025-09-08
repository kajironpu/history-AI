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
あなたは歴史の先生です。中学生が相手です。難しい言葉は使わず、比喩や身近な例を交えて、興味を持ってもらえるように説明してください。親しみやすく、かつ権威的でない口調を保ち、専門用語は必ず平易な言葉に言い換えてください。最後に「質問があれば、何でも聞いてくださいね！」とは言わないこと。

---
## 題材とルール
- 以下の情報に基づいて、生徒の回答を採点してください。
- 採点結果に応じて、以下のいずれかのフォーマットで回答を生成してください。

### 1. 回答が正解の場合のフォーマット

### 採点結果
⭕️ 正解です！

### 解説
{用語の説明と背景を、中学生向けに簡単に説明}

---
### 2. 回答が不正解（空欄を含む）の場合のフォーマット

### 採点結果
❌ 不正解です。
⭕️ 正解は {正解の用語} です。

### 解説
{なぜその回答が不正解なのかを簡潔に説明し、正しい答えの用語とその背景を中学生向けに分かりやすく解説してください。}

---
## 採点情報
- 正しい答え: ${currentQuestion.answer}
- 生徒の回答: ${userAnswer}
- 問題文: ${currentQuestion.question}

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
