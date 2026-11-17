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

    const body = await req.json();
    const question = (body.question || "").trim();
    const resumeText = (body.resumeText || "").trim();
    const jobDescription = (body.jobDescription || "").trim();
    const useStream = Boolean(body.stream);

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const prompt = `You are a real-time interview copilot. Deliver a fast, natural, high-impact spoken answer immediately.
Question: ${question}
${resumeText ? `Candidate Resume: ${resumeText.slice(0, 1400)}` : ""}
${jobDescription ? `Target Role: ${jobDescription.slice(0, 900)}` : ""}

Format your response using these exact headings (keep it concise and punchy):
### Direct Answer
2 crisp, direct sentences the candidate can say out loud immediately.

### STAR Example
1 concise 2-sentence STAR example from their background (skip this heading if the question is not behavioral).

### Key Talking Points
- Short key point 1
- Short key point 2
- Short key point 3`;

    if (useStream) {
      const streamModel = genAI.getGenerativeModel({
        model: "gemini-3.5-flash-lite",
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 320,
        },
      });

      const streamResult = await streamModel.generateContentStream(prompt);
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Stream error";
            controller.enqueue(encoder.encode(`\nError: ${msg}`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Fallback JSON mode for Chrome extension compatibility
    const jsonModel = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
      },
    });

    const jsonPrompt = `${prompt}

Return strict JSON only:
{
  "overview": "2 crisp, direct sentences the candidate can say out loud immediately.",
  "starStory": "1 concise 2-sentence STAR example from their background (or empty string if not behavioral).",
  "bullets": ["Short key point 1", "Short key point 2", "Short key point 3"]
}`;

    const result = await jsonModel.generateContent(jsonPrompt);
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
