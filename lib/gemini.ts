type GeminiPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } }

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { message?: string }
}

type CopilotResponse = {
  summary: string
  recognizedQuestion?: string
  starAnswer: {
    situation: string
    task: string
    action: string
    result: string
  }
  codingSolution: {
    language: string
    code: string
    timeComplexity: string
    spaceComplexity: string
  }
  mermaidChart: string
  suggestedPhrases: string[]
}

type PostSessionSummary = {
  aiNotes: string
  scorecard: {
    overallScore: number
    technicalAccuracy: number
    communicationClarity: number
    problemSolving: number
    verdict: string
  }
  followUpEmail: string
}

async function generateContent(parts: GeminiPart[], apiKey: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    )
  } catch {
    throw new Error("Could not connect to the Gemini API.")
  }

  let payload: GeminiApiResponse
  try {
    payload = (await response.json()) as GeminiApiResponse
  } catch {
    throw new Error(`Gemini returned an invalid response (${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini API request failed (${response.status}).`)
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim()
  if (!text) throw new Error("Gemini returned no generated text.")
  return text
}

function parseJsonResponse<T>(responseText: string): T {
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
  return JSON.parse(cleaned) as T
}

function fallbackCopilotResponse(): CopilotResponse {
  return {
    summary: "AI Copilot active (Fallback Mode: Configure GEMINI_API_KEY in .env for live Gemini intelligence).",
    starAnswer: {
      situation: "Faced high-pressure deployment roadblock.",
      task: "Resolve bottleneck swiftly.",
      action: "Optimized database queries and added caching.",
      result: "Performance improved by 80%.",
    },
    codingSolution: {
      language: "typescript",
      code: "// Example optimized function\nfunction solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    mermaidChart: "graph TD;\n  A[Request] --> B[Load Balancer];\n  B --> C[App Server];",
    suggestedPhrases: [
      "Let's break this down into time and space complexity.",
      "I'll ensure robust idempotency and connection pooling.",
    ],
  }
}

function fallbackPostSessionSummary(): PostSessionSummary {
  return {
    aiNotes: "Strong technical depth and clear architectural communication observed throughout the session.",
    scorecard: {
      overallScore: 90,
      technicalAccuracy: 92,
      communicationClarity: 88,
      problemSolving: 90,
      verdict: "STRONG HIRE",
    },
    followUpEmail: "Subject: Thank you for the insightful discussion\n\nHi Team,\n\nThank you for taking the time to discuss the role today. I am very excited about the opportunity...",
  }
}

export async function getAICopilotResponse({
  question,
  imageBase64,
  audioBase64,
  vaultContext = "",
  mode = "COPILOT",
}: {
  question: string
  imageBase64?: string
  audioBase64?: string
  vaultContext?: string
  mode?: string
}): Promise<CopilotResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey && audioBase64) {
    throw new Error("Audio transcription requires GEMINI_API_KEY to be configured on the server.")
  }
  if (!apiKey) return fallbackCopilotResponse()

  const prompt = `
You are PitchPilot AI, an expert career, coding, interview, and business-meeting copilot.
The user may be in a live interview, coding assessment, or regular business meeting. Follow the supplied mode and session context.
User Vault / Resume Context:
${vaultContext}

User Query / Question / Code:
${question}

${audioBase64 ? `The attached audio is a short capture of the user's shared meeting-tab audio mixed with their microphone. First transcribe it accurately. Only answer if it contains an intelligible question; otherwise set "recognizedQuestion" to an empty string and give a brief empty summary. Do not invent missing speech or answer questions that are not audible.` : ""}

Mode:
${mode}

Provide your response strictly in valid JSON format with the following keys:
{
  "recognizedQuestion": "",
  "summary": "Crisp direct answer or executive overview",
  "starAnswer": {
    "situation": "...",
    "task": "...",
    "action": "...",
    "result": "..."
  },
  "codingSolution": {
    "language": "typescript",
    "code": "...",
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)"
  },
  "mermaidChart": "graph TD;\\n  A[Client] --> B[API Gateway];\\n  B --> C[Microservice];",
  "suggestedPhrases": ["phrase 1", "phrase 2"]
}
If this is a coding question, populate codingSolution. If it is system design, populate mermaidChart. If it is behavioral, populate starAnswer.
`

  const parts: GeminiPart[] = [{ text: prompt }]
  if (audioBase64) {
    const dataUrlMatch = audioBase64.match(/^data:(audio\/[^;]+);base64,([\s\S]*)$/)
    if (!dataUrlMatch || dataUrlMatch[1] !== "audio/wav") {
      throw new Error("Captured audio must be supplied as a base64-encoded WAV file.")
    }
    parts.push({
      inlineData: {
        data: dataUrlMatch[2],
        mimeType: dataUrlMatch[1],
      },
    })
  }
  if (imageBase64) {
    const dataUrlMatch = imageBase64.match(/^data:(image\/[^;]+);base64,([\s\S]*)$/)
    parts.push({
      inlineData: {
        data: dataUrlMatch?.[2] ?? imageBase64,
        mimeType: dataUrlMatch?.[1] ?? "image/png",
      },
    })
  }

  try {
    return parseJsonResponse<CopilotResponse>(await generateContent(parts, apiKey))
  } catch (error) {
    console.error("Gemini Copilot Error:", error)
    throw error
  }
}

export async function generatePostSessionSummary({
  transcript = "",
  roleOrTopic = "Software Engineer",
}: {
  transcript: string
  roleOrTopic?: string
}): Promise<PostSessionSummary> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return fallbackPostSessionSummary()

  const prompt = `
Based on the following interview / pitch transcript for role "${roleOrTopic}", generate a JSON response with:
{
  "aiNotes": "Comprehensive bulleted notes covering technical strengths, communication style, and areas of improvement.",
  "scorecard": {
    "overallScore": 92,
    "technicalAccuracy": 95,
    "communicationClarity": 90,
    "problemSolving": 92,
    "verdict": "STRONG HIRE"
  },
  "followUpEmail": "Subject: Thank you - [Role] Interview\\n\\nDear [Interviewer Name],\\n\\nThank you for the insightful conversation today..."
}
Transcript:
${transcript}
`

  try {
    return parseJsonResponse<PostSessionSummary>(
      await generateContent([{ text: prompt }], apiKey),
    )
  } catch (error) {
    console.error("Gemini Summary Error:", error)
    throw error
  }
}
