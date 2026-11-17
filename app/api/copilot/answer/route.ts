import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
};

function createSseTextStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";

      function consumeLine(line: string) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return false;

        const payload = trimmed.slice(5).trim();
        if (!payload) return false;
        if (payload === "[DONE]") return true;

        const chunk = JSON.parse(payload) as ChatCompletionChunk;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) controller.enqueue(encoder.encode(text));
        return false;
      }

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
            buffer = buffer.slice(newlineIndex + 1);
            if (consumeLine(line)) {
              await reader.cancel();
              controller.close();
              return;
            }
            newlineIndex = buffer.indexOf("\n");
          }
        }

        buffer += decoder.decode();
        if (buffer) consumeLine(buffer);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function textStreamResponse(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body.question || "").trim();
    const resumeText = (body.resumeText || "").trim();
    const jobDescription = (body.jobDescription || "").trim();
    const model = typeof body.model === "string" ? body.model : "gemini-3.5-flash-lite";
    const useStream = Boolean(body.stream);

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const geminiModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-carbon"];
    const openAIModel = model.startsWith("openai:") ? model.slice("openai:".length) : "";
    const groqModel = model.startsWith("groq:") ? model.slice("groq:".length) : "";
    const isGemini = geminiModels.includes(model);
    const isOpenAI = ["gpt-4o-mini", "gpt-4o"].includes(openAIModel);
    const isGroq = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"].includes(groqModel);

    if (!isGemini && !isOpenAI && !isGroq) {
      return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
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

    if (isOpenAI) {
      const openAIKey = process.env.OPENAI_API_KEY;
      if (!openAIKey) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is not configured on server" },
          { status: 400 }
        );
      }

      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openAIModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 320,
          stream: true,
        }),
      });

      if (!upstream.ok) {
        const errorBody = await upstream.json().catch(() => null);
        const message = errorBody?.error?.message || `OpenAI request failed (${upstream.status})`;
        return NextResponse.json({ error: message }, { status: upstream.status });
      }
      if (!upstream.body) {
        return NextResponse.json(
          { error: "OpenAI returned an empty response stream" },
          { status: 502 }
        );
      }

      return textStreamResponse(createSseTextStream(upstream.body));
    }

    if (isGroq) {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return NextResponse.json(
          { error: "GROQ_API_KEY is not configured on server" },
          { status: 400 }
        );
      }

      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 320,
          stream: true,
        }),
      });

      if (!upstream.ok) {
        const errorBody = await upstream.json().catch(() => null);
        const message = errorBody?.error?.message || `Groq request failed (${upstream.status})`;
        return NextResponse.json({ error: message }, { status: upstream.status });
      }
      if (!upstream.body) {
        return NextResponse.json(
          { error: "Groq returned an empty response stream" },
          { status: 502 }
        );
      }

      return textStreamResponse(createSseTextStream(upstream.body));
    }

    if (useStream) {
      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY is not configured on server" },
          { status: 500 }
        );
      }

      const streamModel = genAI.getGenerativeModel({
        model,
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
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return textStreamResponse(readable);
    }

    // Fallback JSON mode for Chrome extension compatibility
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on server" },
        { status: 500 }
      );
    }

    const jsonModel = genAI.getGenerativeModel({
      model,
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
