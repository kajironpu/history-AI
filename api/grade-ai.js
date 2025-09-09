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
        const modelName = "microsoft/Phi-4";

const prompt = `
あなたは歴史の先生です。中学生が相手なので、難しい言葉は使わず、身近な例や比喩を交えて説明してください。専門用語は必ず平易な言葉に言い換えてください。親しみやすい口調で話してください。

⚠️ 注意：
以下のフォーマット以外の文章は絶対に書かないでください。
必ず Markdown の見出し「採点結果」「解説」を使ってください。
見出しは必ず単独の行に置き、そのあとに本文を書いてください。
不要な前置きやあとがきは一切書かないでください。

---

【出力フォーマット】

1. 生徒の回答が正解の場合

【採点結果】  
⭕️ 正解です！  

【解説】  
{用語の意味と背景を、中学生にもわかりやすく説明してください}  

---

2. 生徒の回答が不正解（または空欄）の場合

【採点結果】  
❌ 不正解です。  
⭕️ 正解は {正解の用語} です。  

【解説】  
{なぜ不正解かを一言で説明し、正しい用語とその背景をわかりやすく説明してください}  

---

【採点に必要な情報】  
- 問題文: ${currentQuestion.question}  
- 正しい答え: ${currentQuestion.answer}  
- 生徒の回答: ${userAnswer}  


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
