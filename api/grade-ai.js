// api/grade-ai.js
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        // 文字列としてエラーを返す
        return res.status(405).send('Method not allowed');
    }

    try {
        const { userAnswer, currentQuestion } = req.body;

        if (!userAnswer || !currentQuestion) {
            // 文字列としてエラーを返す
            return res.status(400).send('Invalid request body');
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("エラー: GEMINI_API_KEYが設定されていません。");
            // 文字列としてエラーを返す
            return res.status(500).send("サーバー設定エラー: 環境変数が設定されていません");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const outputText = response.text();

        if (!outputText) {
            // 文字列としてエラーを返す
            return res.status(500).send("AI応答を取得できませんでした");
        }

        // ここが重要な変更点です
        // JSONではなく、取得したテキストをそのままクライアントに返す
        res.status(200).send(outputText);

    } catch (error) {
        console.error("サーバーでのAI採点エラー:", error);
        // 文字列としてエラーを返す
        res.status(500).send(`サーバーエラー: ${error.message}`);
    }
}
