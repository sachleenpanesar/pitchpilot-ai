import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY on server" },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized or expired extension token." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const question = (body.question || "").trim();
    const resumeText = (body.resumeText || "").trim();
    const jobDescription = (body.jobDescription || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 320,
        responseMimeType: "application/json",
      },
    });

    const prompt = `You are a real-time interview copilot. Deliver a fast, natural, high-impact spoken answer.
Question: ${question}
${resumeText ? `Candidate Resume: ${resumeText.slice(0, 1500)}` : ""}
${jobDescription ? `Target Job Description: ${jobDescription.slice(0, 1000)}` : ""}

Return strict JSON only:
{
  "overview": "2 crisp, direct sentences the candidate can say out loud immediately.",
  "starStory": "1 concise 2-sentence STAR example from their background (or empty string if not behavioral).",
  "bullets": ["Short key point 1", "Short key point 2", "Short key point 3"]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    let parsed: { overview?: string; starStory?: string; bullets?: string[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { overview: raw, starStory: "", bullets: [] };
    }

    return NextResponse.json({
      overview: parsed.overview || "",
      starStory: parsed.starStory || "",
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate answer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
