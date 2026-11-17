import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY in server environment" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile || audioFile.size < 1000) {
      return NextResponse.json({ text: "" });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const cleanMimeType = (audioFile.type || "audio/webm").split(";")[0].trim() || "audio/webm";

    const prompt =
      "Transcribe ONLY clear human speech in this audio clip. If there is silence, background noise, or no clear words, return strictly EMPTY (nothing at all). Never output timestamps like 00:00 or descriptions.";

    let rawText = "";
    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio,
            },
          },
          prompt,
        ]);
        rawText = result.response.text().trim();
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) {
      throw lastError;
    }

    let text = rawText;
    if (/^[\d:\.\[\]\(\)\-\s]+$/.test(text) || /^(silence|no speech|inaudible|empty)\.?$/i.test(text)) {
      text = "";
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to transcribe audio";
    console.error("Transcription error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
