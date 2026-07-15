import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure JSON parsing middleware is attached if we need POST (we use GET here)
  app.use(express.json());

  app.get("/api/problem", async (req, res) => {
    try {
      const difficulty = req.query.difficulty as string;
      if (!difficulty) {
        return res.status(400).json({ error: "Missing difficulty" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Generate a math problem appropriate for the following difficulty level: "${difficulty}".
Difficulty Levels description:
- 算数低 (Math Low): 1st to 3rd grade elementary school (Basic arithmetic, simple logic)
- 算数高 (Math High): 4th to 6th grade elementary school (Fractions, decimals, geometry basics)
- 数学低 (Math Low, Middle School): 1st to 3rd grade middle school (Algebra, linear equations, geometry)
- 数学中 (Math Mid, High School): 1st to 3rd grade high school (Trigonometry, calculus, probability)
- 数学高 (Math High, University): 1st to 4th year university (Linear algebra, differential equations, real analysis, abstract algebra)

Generate exactly one problem and its complete solution.

CRITICAL OUTPUT RULES (must follow, the answer is auto-graded by exact/numeric match):
- Everything in Japanese. NO LaTeX and NO markdown. Do NOT use "$", "\\frac", "\\sqrt", "\\(", backslashes, or math delimiters.
- Write math in PLAIN TEXT only: use x^2 (or x²), √2, 1/2, π, ×, ÷, ≦. Fractions as a/b.
- "solution" MUST be a SINGLE short answer a student can type: one integer, one decimal, one fraction "a/b", or a very short value like "π" or "e".
  - No sentences, no units, no words, no "x=" prefix, no multiple values, no LaTeX. Just the bare value. (Good: "5", "3/4", "-2", "12.5". Bad: "x = 5", "極大値 f(0)=2, 極小値 f(2)=-2", "5 cm", "$5$".)
  - Design the problem so it has exactly ONE unambiguous short numeric/fraction answer. Avoid "list all", "prove", "describe" type questions.
- "explanation": plain-text Japanese, concise steps (no LaTeX).

Return PURE JSON only (no markdown fences), exactly:
{"problem":"（日本語の問題文・プレーンテキスト）","solution":"（短い1つの答えのみ）","explanation":"（日本語の途中式・プレーンテキスト）"}`;

      // 毎回ちがう問題になるよう nonce を添える
      const variedPrompt = `${prompt}\n\n毎回できるだけ異なる問題にしてください。(variation-seed: ${Date.now()}-${Math.floor(Math.random() * 1e9)})`;

      // 利用可能なモデルを順に試す（環境により使えるモデルが違うため）
      const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-1.5-flash'];
      let response: any = undefined;
      let lastErr = '';
      for (const model of MODELS) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: variedPrompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 1.0,
              // 高速化: 2.5系は既定で thinking が有効で 10-20秒かかる。無効化して数秒に短縮。
              thinkingConfig: { thinkingBudget: 0 },
              maxOutputTokens: 2048,
            },
          });
          if (response && response.text) { break; }
        } catch (e: any) {
          lastErr = `${model}: ${e?.message || e}`;
          console.log(`Model ${model} failed:`, e?.message || e);
          response = undefined;
        }
      }

      if (!response || !response.text) {
        console.warn(`All models failed. Returning static fallback. lastErr=${lastErr}`);
        const fallbackProblems: any = {
          '算数低': { problem: '1 + 1 はいくつですか？', solution: '2', explanation: '1つと1つを合わせると2になります。' },
          '算数高': { problem: '1/2 + 1/4 を計算してください。', solution: '3/4', explanation: '分母を4で揃えると 2/4 + 1/4 = 3/4 になります。' },
          '数学低': { problem: '方程式 2x = 10 を解いてください。', solution: '5', explanation: '両辺を2で割ると x = 5 となります。' },
          '数学中': { problem: '関数 f(x) = x^2 の導関数 f\'(x) を求めてください。', solution: '2x', explanation: 'x^n の導関数は nx^(n-1) となります。' },
          '数学高': { problem: '行列 [1 0; 0 1] の行列式を求めてください。', solution: '1', explanation: '対角成分の積から非対角成分の積を引きます: 1*1 - 0*0 = 1' }
        };
        const fallback = fallbackProblems[difficulty] || fallbackProblems['算数低'];
        return res.json({ ...fallback, _debug: lastErr.slice(0, 400) });
      }

      // 応答を頑健に解釈: フェンス除去 + LaTeX無害化。失敗しても500にせず静的フォールバック。
      const sanitize = (s: string) => String(s == null ? '' : s)
        .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2')
        .replace(/\\sqrt\s*\{([^}]*)\}/g, '√($1)')
        .replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\cdot/g, '×').replace(/\\pi/g, 'π')
        .replace(/\\left|\\right|\\displaystyle|\\,|\\!|\\;/g, '')
        .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, '')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      let parsed: any = null;
      try {
        const jsonStr = String(response.text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch { parsed = null; }
      if (parsed && typeof parsed.problem === 'string' && typeof parsed.solution === 'string' && typeof parsed.explanation === 'string'
          && parsed.problem.trim() && parsed.solution.trim() && parsed.explanation.trim()) {
        return res.json({ problem: sanitize(parsed.problem), solution: sanitize(parsed.solution), explanation: sanitize(parsed.explanation) });
      }
      // 解釈不能: 静的フォールバック（500にしない）
      const fb: any = {
        '算数低': { problem: '1 + 1 はいくつですか？', solution: '2', explanation: '1つと1つを合わせると2になります。' },
        '算数高': { problem: '1/2 + 1/4 を計算してください。', solution: '3/4', explanation: '分母を4で揃えると 2/4 + 1/4 = 3/4 になります。' },
        '数学低': { problem: '方程式 2x = 10 を解いてください。', solution: '5', explanation: '両辺を2で割ると x = 5 となります。' },
        '数学中': { problem: '関数 f(x) = x^2 の導関数の x=1 での値は？', solution: '2', explanation: "f'(x)=2x なので f'(1)=2 です。" },
        '数学高': { problem: '行列 [[1,0],[0,1]] の行列式は？', solution: '1', explanation: '対角成分の積 1×1 − 0×0 = 1 です。' }
      };
      return res.json({ ...(fb[difficulty] || fb['算数低']), _debug: 'parse_failed:' + String(response.text).slice(0, 120) });
    } catch (error: any) {
      console.error("Error generating problem:", error);
      let errorMessage = error.message || "Failed to generate problem";
      if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded")) {
        errorMessage = "APIの利用制限（クオータ制限）に達しました。しばらく待ってから再度お試しください。";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
