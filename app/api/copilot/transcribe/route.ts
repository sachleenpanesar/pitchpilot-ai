import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "Transcription is unavailable: GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const contentType = req.headers.get("content-type")?.toLowerCase() || "";
    let arrayBuffer: ArrayBuffer;
    let mimeType: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("file") || formData.get("audio");
      if (!(audioFile instanceof Blob)) {
        return NextResponse.json(
          { error: "Audio file is missing. Send it as a multipart 'file' or 'audio' field." },
          { status: 400 }
        );
      }

      arrayBuffer = await audioFile.arrayBuffer();
      mimeType = audioFile.type || "audio/wav";
    } else if (contentType.startsWith("audio/") || contentType.startsWith("application/octet-stream")) {
      arrayBuffer = await req.arrayBuffer();
      mimeType = contentType.startsWith("audio/")
        ? contentType.split(";")[0].trim()
        : "audio/wav";
    } else {
      arrayBuffer = await req.arrayBuffer();
      mimeType = "audio/wav";
    }

    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Audio payload is empty. Record or upload audio and try again." },
        { status: 400 }
      );
    }

    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 120,
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
      "Transcribe ONLY clear human speech in English. If the audio is silent, background noise, music, or unclear, return an empty string. Never output labels like 'audio', timestamps like '00:00', or sound descriptions.",
    ]);

    const text = result.response.text().trim();
    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

