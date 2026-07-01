import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

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
Please return the result in pure JSON format (without markdown block wrappers) like this:
{
  "problem": "The problem statement goes here in Japanese, formatting math equations clearly.",
  "solution": "The final concise answer (e.g., 'x = 5' or '42')",
  "explanation": "A step-by-step explanation of how to solve the problem in Japanese."
}
No other text outside the JSON block.`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: 'HIGH' },
            responseMimeType: 'application/json',
          }
        });
      } catch (primaryError: any) {
        console.log("Primary model (gemini-3.1-pro-preview) failed, attempting fallback to gemini-2.0-flash:", primaryError.message);
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });
        } catch (fallbackError: any) {
          if (fallbackError.message.includes("429") || fallbackError.message.includes("Quota") || primaryError.message.includes("429") || primaryError.message.includes("Quota")) {
            console.log("Quota exceeded, returning fallback problem");
            const fallbackProblems: any = {
              '算数低': { problem: '1 + 1 はいくつですか？', solution: '2', explanation: '1つと1つを合わせると2になります。' },
              '算数高': { problem: '1/2 + 1/4 を計算してください。', solution: '3/4', explanation: '分母を4で揃えると 2/4 + 1/4 = 3/4 になります。' },
              '数学低': { problem: '方程式 2x = 10 を解いてください。', solution: '5', explanation: '両辺を2で割ると x = 5 となります。' },
              '数学中': { problem: '関数 f(x) = x^2 の導関数 f\'(x) を求めてください。', solution: '2x', explanation: 'x^n の導関数は nx^(n-1) となります。' },
              '数学高': { problem: '行列 [1 0; 0 1] の行列式を求めてください。', solution: '1', explanation: '対角成分の積から非対角成分の積を引きます: 1*1 - 0*0 = 1' }
            };
            const fallback = fallbackProblems[difficulty] || fallbackProblems['算数低'];
            return res.json(fallback);
          }
          throw new Error(`Both primary and fallback models failed. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`);
        }
      }

      if (!response.text) {
        throw new Error("No response from AI");
      }
      
      const parsed = JSON.parse(response.text);
      res.json(parsed);
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
