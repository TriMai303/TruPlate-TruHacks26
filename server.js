import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.use(cors());
app.use(express.json());

app.get("/api/menu", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  try {
    const url = "https://truman.sodexomyway.com/en-us/locations/ryle-dining-hall";

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });

    const html = await response.text();

    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});?\s*<\/script>/s);

    if (!match) {
      console.error("Could not find __PRELOADED_STATE__ in HTML");
      return res.status(500).json({ error: "Could not find menu data in page." });
    }

    const state = JSON.parse(match[1]);

    const rawSections = state?.composition?.subject?.regions
      ?.flatMap(r => r.fragments)
      ?.find(f => f.type === "Menu")
      ?.content?.main?.sections || [];

    const sections = rawSections.map(section => ({
      section: section.name,
      items: section.groups.flatMap(g => g.items)
        .filter(item => item.formalName && item.formalName !== "Have A Nice Day")
        .map(item => ({
          name: item.formalName,
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbohydrates,
          fiber: item.dietaryFiber,
          portion: item.portion,
          isVegan: item.isVegan,
          isVegetarian: item.isVegetarian,
          allergens: (item.allergens || []).map(a => a.name)
        }))
    })).filter(s => s.items.length > 0);

    console.log("Sections found:", sections.length);
    res.json({ date, sections });

  } catch (error) {
    console.error("MENU ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch menu.", details: error.message });
  }
});

app.post("/api/generate-meal", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "Missing GROQ_API_KEY in .env"
      });
    }

    const { menuSections, goals, preferences } = req.body;

    if (!Array.isArray(menuSections) || !menuSections.length) {
      return res.status(400).json({
        error: "No menu sections provided."
      });
    }

    const prompt = `
You are an AI nutrition assistant for Truman State students.

Use ONLY foods from this live dining hall menu:
${JSON.stringify(menuSections, null, 2)}

Student nutrition goals:
${JSON.stringify(goals, null, 2)}

Dietary preferences:
${JSON.stringify(preferences, null, 2)}

Instructions:
- Only use foods that appear in the menu sections provided
- Build one realistic meal
- Make the recommendation practical for a student dining hall plate
- Stay within +-60 of the calorie goal and +-5 of all other nutrition goals (protein, fat, carbs, fiber)
- If exact nutrition values are unknown, estimate carefully and clearly
- Keep explanations short and useful

Return ONLY valid JSON in this exact format with no extra text:
{
  "mealItems": [
    {
      "name": "Food name",
      "portion": "portion size",
      "reason": "short reason"
    }
  ],
  "estimatedTotals": {
    "calories": "estimated total",
    "protein": "estimated total",
    "carbs": "estimated total",
    "fat": "estimated total",
    "fiber": "estimated total"
  },
  "goalMatch": "one short sentence",
  "tips": ["tip 1", "tip 2"]
}
`;

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200,
          temperature: 0.4
        })
      }
    );

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(500).json({
        error: groqData?.error?.message || "Groq API request failed."
      });
    }

    const text = groqData?.choices?.[0]?.message?.content || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  return res.status(500).json({
    error: "AI returned non-JSON output.",
    raw: text
  });
}
const cleaned = jsonMatch[0].trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      return res.status(500).json({
        error: "AI returned non-JSON output.",
        raw: text
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate meal.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});