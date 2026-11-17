"use client"

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle,
  Clipboard,
  FileImage,
  LoaderCircle,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  X,
} from "lucide-react"
import StealthModeToggle, { type StealthModeState } from "@/components/stealth-mode-toggle"

type CopilotResult = {
  summary?: string
  recognizedQuestion?: string
  starAnswer?: { situation?: string; task?: string; action?: string; result?: string }
  codingSolution?: {
    language?: string
    code?: string
    timeComplexity?: string
    spaceComplexity?: string
  }
  mermaidChart?: string
  suggestedPhrases?: string[]
}

type TranscriptEntry = { speaker: "You" | "PitchPilot"; text: string }
type SessionSummary = {
  aiNotes?: string
  scorecard?: {
    overallScore?: number | string
    technicalAccuracy?: number | string
    communicationClarity?: number | string
    problemSolving?: number | string
    verdict?: string
  } | null
  followUpEmail?: string
}
type SessionData = {
  id: string
  title: string
  companyOrClient: string
  mode: string
  language: string
  status: string
  transcript?: string | null
  aiNotes?: string | null
  scorecard?: string | null
  followUpEmail?: string | null
}
type DiagramNode = { id: string; label: string }
type DiagramEdge = { from: string; to: string }

type SpeechRecognitionResultLike = { transcript: string }
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function fileAsPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error("Could not read the screenshot."))
        return
      }
      context.drawImage(image, 0, 0)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL("image/png"))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not load the screenshot."))
    }
    image.src = objectUrl
  })
}

function audioBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not encode the captured audio."))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error("Could not encode the captured audio."))
    reader.readAsDataURL(blob)
  })
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  writeText(0, "RIFF")
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeText(8, "WAVE")
  writeText(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, "data")
  view.setUint32(40, sampleCount * 2, true)

  let offset = 44
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: "audio/wav" })
}

function parseFlowchart(source: string): { nodes: DiagramNode[]; edges: DiagramEdge[]; direction: "LR" | "TB" } {
  const lines = source.split(/[\n;]/).map((line) => line.trim()).filter(Boolean)
  const header = lines.shift() || ""
  const direction: "LR" | "TB" = /\b(?:LR|RL)\b/i.test(header) ? "LR" : "TB"
  const nodes = new Map<string, string>()
  const edges: DiagramEdge[] = []
  const nodePattern = /([A-Za-z]\w*)\s*(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?/g
  const connectors = /-->|---|==>|-.->/g

  for (const line of lines) {
    const segments = line.split(connectors)
    for (let index = 0; index < segments.length - 1; index += 1) {
      const leftMatches = Array.from(segments[index].matchAll(nodePattern))
      const rightMatches = Array.from(segments[index + 1].matchAll(nodePattern))
      const left = leftMatches[leftMatches.length - 1]
      const right = rightMatches[0]
      const from = left?.[1]
      const to = right?.[1]
      if (from && to) {
        edges.push({ from, to })
        if (!nodes.has(from)) nodes.set(from, left?.[2] || left?.[3] || left?.[4] || from)
        if (!nodes.has(to)) nodes.set(to, right?.[2] || right?.[3] || right?.[4] || to)
      }
    }
  }
  return {
    nodes: Array.from(nodes, ([id, label]) => ({ id, label })),
    edges,
    direction,
  }
}

function MermaidPreview({ source }: { source: string }) {
  const { nodes, edges, direction } = parseFlowchart(source)
  if (!nodes.length || !edges.length) return null
  const horizontal = direction === "LR"
  const width = horizontal ? Math.max(540, nodes.length * 190) : 540
  const height = horizontal ? 190 : Math.max(200, nodes.length * 100)
  const positions = new Map(nodes.map((node, index) => [
    node.id,
    horizontal ? { x: 25 + index * 190, y: 65 } : { x: (width - 170) / 2, y: 20 + index * 100 },
  ]))

  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-cyan-900/60 bg-zinc-950 p-3" aria-label="Diagram preview">
      <svg width={width} height={height} role="img" aria-label="Flowchart preview">
        <defs>
          <marker id="diagram-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#67e8f9" />
          </marker>
        </defs>
        {edges.map((edge, index) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) return null
          return (
            <line
              key={`${edge.from}-${edge.to}-${index}`}
              x1={horizontal ? from.x + 170 : from.x + 85}
              y1={horizontal ? from.y + 32 : from.y + 64}
              x2={horizontal ? to.x : to.x + 85}
              y2={horizontal ? to.y + 32 : to.y}
              stroke="#67e8f9"
              strokeWidth="2"
              markerEnd="url(#diagram-arrow)"
            />
          )
        })}
        {nodes.map((node) => {
          const point = positions.get(node.id)
          if (!point) return null
          return (
            <g key={node.id}>
              <rect x={point.x} y={point.y} width="170" height="64" rx="12" fill="#164e63" stroke="#22d3ee" />
              <text x={point.x + 85} y={point.y + 28} textAnchor="middle" fill="#ecfeff" fontSize="13">{node.label.slice(0, 25)}</text>
              <text x={point.x + 85} y={point.y + 47} textAnchor="middle" fill="#a5f3fc" fontSize="10">{node.id}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function CopilotRoomPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const sessionId = params.id
  const [session, setSession] = useState<SessionData | null>(null)
  const [sessionError, setSessionError] = useState("")
  const [question, setQuestion] = useState("")
  const [result, setResult] = useState<CopilotResult | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [screenshot, setScreenshot] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [stealthState, setStealthState] = useState<StealthModeState>({
    isPanicked: false,
    isVsCodeTheme: false,
    isTitleDisguised: false,
    opacity: 1,
  })
  const [recognitionAvailable, setRecognitionAvailable] = useState(true)
  const [captureActive, setCaptureActive] = useState(false)
  const [captureStarting, setCaptureStarting] = useState(false)
  const [captureMessage, setCaptureMessage] = useState("")
  const [autoAnswer, setAutoAnswer] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const audioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([])
  const silentGainRef = useRef<GainNode | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
  const preRollRef = useRef<Float32Array[]>([])
  const recordedSamplesRef = useRef(0)
  const silenceSamplesRef = useRef(0)
  const speakingRef = useRef(false)
  const autoAnswerRef = useRef(false)
  const audioQueueRef = useRef<Blob[]>([])
  const processingAudioRef = useRef(false)
  const requestBusyRef = useRef(false)
  const mountedRef = useRef(true)
  const isMock = session?.mode === "MOCK_INTERVIEW"

  useEffect(() => {
    let active = true
    fetch("/api/sessions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your sessions. Please sign in again.")
        return response.json()
      })
      .then((sessions: SessionData[]) => {
        if (!active) return
        const found = sessions.find((item) => item.id === sessionId)
        if (!found) {
          setSessionError("This session could not be found in your account.")
          return
        }
        setSession(found)
        if (found.transcript) {
          try {
            const saved = JSON.parse(found.transcript)
            if (Array.isArray(saved)) setTranscript(saved)
          } catch {
            setTranscript([{ speaker: "You", text: found.transcript }])
          }
        }
        if (found.aiNotes || found.scorecard || found.followUpEmail) {
          let scorecard = null
          try {
            scorecard = found.scorecard ? JSON.parse(found.scorecard) : null
          } catch {
            scorecard = null
          }
          setSummary({
            aiNotes: found.aiNotes ?? undefined,
            scorecard,
            followUpEmail: found.followUpEmail ?? undefined,
          })
        }
      })
      .catch((loadError: Error) => {
        if (active) setSessionError(loadError.message)
      })
    return () => {
      active = false
      recognitionRef.current?.stop()
    }
  }, [sessionId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopMeetingCapture("", false)
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    autoAnswerRef.current = autoAnswer
    if (!autoAnswer) {
      audioChunksRef.current = []
      preRollRef.current = []
      recordedSamplesRef.current = 0
      silenceSamplesRef.current = 0
      speakingRef.current = false
      audioQueueRef.current = []
    }
  }, [autoAnswer])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  const addTranscript = (entries: TranscriptEntry[]) => {
    setTranscript((previous) => [...previous, ...entries])
  }

  const runQuery = async (prompt: string, imageBase64?: string, displayQuestion = prompt) => {
    if (requestBusyRef.current) return
    requestBusyRef.current = true
    setBusy(true)
    setError("")
    addTranscript([{ speaker: "You", text: displayQuestion }])
    try {
      const response = await fetch("/api/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          imageBase64,
          mode: session?.mode || "LIVE_COPILOT",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not get an AI response.")
      const data = payload.data as CopilotResult
      setResult(data)
      addTranscript([{ speaker: "PitchPilot", text: data.summary || "Response received." }])
      setQuestion("")
      setScreenshot("")
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.")
    } finally {
      requestBusyRef.current = false
      setBusy(false)
      void drainAutoAnswerQueue()
    }
  }

  const drainAutoAnswerQueue = async () => {
    if (processingAudioRef.current || requestBusyRef.current || !autoAnswerRef.current) return
    const audioBlob = audioQueueRef.current.shift()
    if (!audioBlob) return

    processingAudioRef.current = true
    requestBusyRef.current = true
    setBusy(true)
    setError("")
    setCaptureMessage("Listening for a question… sending the detected audio to Gemini.")
    try {
      const audioBase64 = await audioBlobAsDataUrl(audioBlob)
      const response = await fetch("/api/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mode: session?.mode || "LIVE_COPILOT",
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        data?: CopilotResult
        transcription?: string
      }
      if (!response.ok) throw new Error(payload.error || "Could not transcribe the captured audio.")

      const recognizedQuestion = payload.transcription?.trim() || payload.data?.recognizedQuestion?.trim()
      if (recognizedQuestion && payload.data) {
        setResult(payload.data)
        addTranscript([
          { speaker: "You", text: recognizedQuestion },
          { speaker: "PitchPilot", text: payload.data.summary || "Response received." },
        ])
        setCaptureMessage("Question answered. Listening for the next one…")
        router.refresh()
      } else {
        setCaptureMessage("No clear question was detected. Listening for the next one…")
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not process the captured audio.")
      setCaptureMessage("Audio capture is still active. Check the error and try again.")
    } finally {
      requestBusyRef.current = false
      processingAudioRef.current = false
      setBusy(false)
      if (audioQueueRef.current.length && autoAnswerRef.current) void drainAutoAnswerQueue()
    }
  }

  function stopMeetingCapture(message = "", updateState = true) {
    const displayStream = displayStreamRef.current
    const microphoneStream = microphoneStreamRef.current
    const audioContext = audioContextRef.current
    const processor = audioProcessorRef.current
    displayStreamRef.current = null
    microphoneStreamRef.current = null
    audioContextRef.current = null
    audioProcessorRef.current = null
    audioChunksRef.current = []
    preRollRef.current = []
    recordedSamplesRef.current = 0
    audioQueueRef.current = []
    silenceSamplesRef.current = 0
    speakingRef.current = false

    if (processor) {
      processor.onaudioprocess = null
      try { processor.disconnect() } catch { /* Already disconnected. */ }
    }
    for (const source of audioSourcesRef.current) {
      try { source.disconnect() } catch { /* Already disconnected. */ }
    }
    audioSourcesRef.current = []
    if (silentGainRef.current) {
      try { silentGainRef.current.disconnect() } catch { /* Already disconnected. */ }
      silentGainRef.current = null
    }
    for (const stream of [displayStream, microphoneStream]) {
      stream?.getTracks().forEach((track) => {
        track.onended = null
        if (track.readyState !== "ended") track.stop()
      })
    }
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined)
    }
    if (updateState && mountedRef.current) {
      setCaptureActive(false)
      setCaptureStarting(false)
      setCaptureMessage(message)
    }
  }

  const startMeetingCapture = async () => {
    if (captureActive || captureStarting) return
    setCaptureMessage("")
    setError("")
    setCaptureStarting(true)

    let displayStream: MediaStream | null = null
    let microphoneStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    try {
      if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices.getUserMedia) {
        throw new Error("This browser does not support screen and microphone capture. Try a current desktop browser over HTTPS.")
      }
      audioContext = new AudioContext()
      audioContextRef.current = audioContext
      await audioContext.resume()
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      displayStreamRef.current = displayStream
      if (!displayStream.getAudioTracks().length) {
        throw new Error("No shared-tab audio was received. Stop sharing, choose a browser tab, and enable its “Share tab audio” option.")
      }
      if (!mountedRef.current) {
        displayStream.getTracks().forEach((track) => track.stop())
        return
      }

      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneStreamRef.current = microphoneStream
      if (!microphoneStream.getAudioTracks().length) {
        throw new Error("No microphone audio track was received. Check your microphone and browser permissions.")
      }
      if (!mountedRef.current) {
        displayStream.getTracks().forEach((track) => track.stop())
        microphoneStream.getTracks().forEach((track) => track.stop())
        return
      }

      const processor = audioContext.createScriptProcessor(4096, 2, 1)
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      processor.connect(silentGain)
      silentGain.connect(audioContext.destination)
      audioProcessorRef.current = processor
      silentGainRef.current = silentGain

      const audioOnlyDisplay = new MediaStream(displayStream.getAudioTracks())
      const audioOnlyMicrophone = new MediaStream(microphoneStream.getAudioTracks())
      const displaySource = audioContext.createMediaStreamSource(audioOnlyDisplay)
      const microphoneSource = audioContext.createMediaStreamSource(audioOnlyMicrophone)
      displaySource.connect(processor)
      microphoneSource.connect(processor)
      audioSourcesRef.current = [displaySource, microphoneSource]

      const speechThreshold = 0.012
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!autoAnswerRef.current) return
        const input = event.inputBuffer
        const left = input.getChannelData(0)
        const right = input.numberOfChannels > 1 ? input.getChannelData(1) : left
        const mono = new Float32Array(input.length)
        let energy = 0
        for (let index = 0; index < input.length; index += 1) {
          const sample = (left[index] + right[index]) / 2
          mono[index] = sample
          energy += sample * sample
        }
        const rms = Math.sqrt(energy / input.length)
        const sampleRate = audioContext?.sampleRate ?? 48000

        if (!speakingRef.current && rms >= speechThreshold) {
          speakingRef.current = true
          audioChunksRef.current = [...preRollRef.current]
          recordedSamplesRef.current = audioChunksRef.current.reduce((total, chunk) => total + chunk.length, 0)
          preRollRef.current = []
        }
        if (speakingRef.current) {
          audioChunksRef.current.push(mono)
          recordedSamplesRef.current += mono.length
          silenceSamplesRef.current = rms < speechThreshold
            ? silenceSamplesRef.current + input.length
            : 0
          if (silenceSamplesRef.current >= sampleRate * 1.5 || recordedSamplesRef.current >= sampleRate * 45) {
            const completedChunks = audioChunksRef.current
            audioChunksRef.current = []
            recordedSamplesRef.current = 0
            silenceSamplesRef.current = 0
            speakingRef.current = false
            if (completedChunks.length) {
              audioQueueRef.current.push(encodeWav(completedChunks, sampleRate))
              void drainAutoAnswerQueue()
            }
          }
        } else {
          preRollRef.current.push(mono)
          const preRollLimit = sampleRate * 0.25
          let preRollLength = preRollRef.current.reduce((total, chunk) => total + chunk.length, 0)
          while (preRollLength > preRollLimit && preRollRef.current.length) {
            const removed = preRollRef.current.shift()
            if (removed) preRollLength -= removed.length
          }
        }
      }

      const stopOnTrackEnd = () => {
        stopMeetingCapture("Meeting tab or microphone sharing ended.")
      }
      for (const track of [...displayStream.getTracks(), ...microphoneStream.getTracks()]) {
        track.onended = stopOnTrackEnd
      }
      setCaptureActive(true)
      setCaptureMessage(autoAnswerRef.current
        ? "Shared-tab and microphone audio are captured locally. Listening for questions…"
        : "Capture is ready. Turn on Auto-Answer to detect and submit questions.")
    } catch (captureError) {
      stopMeetingCapture("", false)
      const name = captureError instanceof DOMException ? captureError.name : ""
      const detail = captureError instanceof Error ? captureError.message : "Could not start audio capture."
      const message = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Screen sharing or microphone permission was denied. Allow both when prompted, then start capture again."
        : name === "NotFoundError"
          ? "No microphone was found. Connect a microphone and try again."
          : name === "NotReadableError"
            ? "The selected tab or microphone could not be read. Close other apps using the device and try again."
            : detail
      if (mountedRef.current) {
        setCaptureStarting(false)
        setCaptureActive(false)
        setCaptureMessage(message)
      }
    }
  }

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = question.trim()
    if (!text && !screenshot) return
    void runQuery(
      text || "Analyze the pasted screenshot. Identify the question or code shown, then provide a clear solution.",
      screenshot || undefined,
      text || "Analyze pasted screenshot",
    )
  }

  const acceptImage = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return
    try {
      setScreenshot(await fileAsPng(file))
      setError("")
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Could not use that screenshot.")
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))
    const file = imageItem?.getAsFile()
    if (file) {
      event.preventDefault()
      void acceptImage(file)
    }
  }

  const toggleSpeechInput = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setRecognitionAvailable(false)
      return
    }
    const recognition = new Recognition()
    recognition.lang = session?.language === "English" ? "en-US" : session?.language || "en-US"
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results).map((item) => item[0]?.transcript || "").join(" ")
      setQuestion((previous) => `${previous}${previous ? " " : ""}${spoken}`.trim())
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const askMockQuestion = () => {
    void runQuery(
      "MOCK INTERVIEW: Act as a supportive interviewer for the role shown in this session. Ask exactly one concise, realistic interview question. Do not answer it or provide coaching yet.",
      undefined,
      "Start mock interview — ask the first question",
    )
  }

  const submitMockAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const answer = question.trim()
    if (!answer) return
    void runQuery(
      `MOCK INTERVIEW: The candidate answered: "${answer}". Give brief, constructive feedback on the answer, then ask exactly one relevant next interview question. Keep the feedback and next question concise.`,
      undefined,
      answer,
    )
  }

  const generateSummary = async () => {
    setSummaryBusy(true)
    setError("")
    try {
      const response = await fetch("/api/copilot/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          transcript: JSON.stringify(transcript),
          roleOrTopic: session?.companyOrClient || session?.title || "Software Engineer",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not generate the session summary.")
      setSummary(payload.summary)
      setSession((previous) => previous ? { ...previous, status: "COMPLETED" } : previous)
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Could not generate the session summary.")
    } finally {
      setSummaryBusy(false)
    }
  }

  const speakSummary = () => {
    if (!result?.summary || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.summary))
  }

  const cardClass = "rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
  const captureHasError = /denied|could not|not support|no microphone|no shared-tab|permission/i.test(captureMessage)

  return (
    <div
      onPaste={handlePaste}
      className={`min-h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-100 transition-opacity duration-200 ${stealthState.isPanicked ? "opacity-0" : ""}`}
      style={{ opacity: stealthState.opacity }}
    >
      <div className="border-b border-zinc-800 bg-zinc-900/90 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm text-indigo-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </button>
            <span className="text-zinc-700">/</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Sparkles className="h-4 w-4" /> {isMock ? "Mock Interview" : "Interview Copilot"}
            </span>
          </div>
          <StealthModeToggle
            initialOpacity={stealthState.opacity}
            initialPanic={stealthState.isPanicked}
            initialVsCodeTheme={stealthState.isVsCodeTheme}
            initialTitleDisguise={stealthState.isTitleDisguised}
            onStateChange={setStealthState}
          />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <section className="space-y-5">
          {sessionError ? (
            <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{sessionError}</div>
          ) : !session ? (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading session…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">{session.mode.replaceAll("_", " ")}</p>
                  <h1 className="mt-1 text-2xl font-bold">{session.title}</h1>
                  <p className="mt-1 text-sm text-zinc-400">{session.companyOrClient} · {session.language}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${session.status === "COMPLETED" ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : "border-indigo-800 bg-indigo-950/40 text-indigo-300"}`}>
                  {session.status}
                </span>
              </div>

              <div className={cardClass}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">{isMock ? "Practice question" : "Ask PitchPilot"}</h2>
                  <button
                    type="button"
                    onClick={speakSummary}
                    disabled={!result?.summary}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-40"
                    title="Read the latest answer aloud"
                  >
                    <Volume2 className="h-4 w-4" /> Read answer
                  </button>
                </div>

                {isMock && (
                  <div className="mb-4 rounded-xl border border-purple-800/60 bg-purple-950/30 p-3 text-sm text-purple-100">
                    Practice mode: ask for a question, answer in your own words, and get concise feedback before continuing.
                    {!transcript.length && <button onClick={askMockQuestion} disabled={busy} className="ml-2 font-semibold text-purple-300 underline disabled:opacity-50">Ask first question</button>}
                  </div>
                )}

                <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">Meeting audio</h3>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">
                        Explicitly share a browser tab with its audio, then allow microphone access. Only detected audio segments are sent to Gemini while Auto-Answer is on; audio is not saved in your transcript.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (captureActive) stopMeetingCapture("Meeting audio capture stopped.")
                        else void startMeetingCapture()
                      }}
                      disabled={captureStarting || (!captureActive && busy)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${captureActive ? "border-red-800 bg-red-950/50 text-red-200 hover:bg-red-950" : "border-indigo-700 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-950"}`}
                    >
                      {captureStarting ? "Waiting for permissions…" : captureActive ? "Stop Meeting Audio Capture" : "Capture Meeting Tab Audio"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoAnswer}
                      onClick={() => setAutoAnswer((enabled) => !enabled)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${autoAnswer ? "border-emerald-700 bg-emerald-950/50 text-emerald-200" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                    >
                      Auto-Answer: {autoAnswer ? "On" : "Off"}
                    </button>
                    <span className="text-xs text-zinc-500">
                      {captureActive
                        ? autoAnswer ? "Listening for speech; a question is submitted after 1.5 seconds of silence." : "Audio capture is active; automatic transcription is off."
                        : "Start sharing first. The browser will ask you to select the meeting tab and microphone."}
                    </span>
                  </div>
                  {captureMessage && <p role={captureHasError ? "alert" : "status"} className={`mt-3 text-xs ${captureHasError ? "text-amber-300" : "text-zinc-300"}`}>{captureMessage}</p>}
                  {captureActive && autoAnswer && (
                    <p className="mt-2 text-xs text-amber-200">
                      Audio is sent to the configured Gemini service for transcription and an answer. Do not capture a meeting unless you have permission to do so.
                    </p>
                  )}
                </div>

                <form onSubmit={isMock ? submitMockAnswer : submitQuestion}>
                  <label htmlFor="copilot-question" className="sr-only">{isMock ? "Your interview answer" : "Question for PitchPilot"}</label>
                  <textarea
                    id="copilot-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={isMock ? "Type your answer to the current interview question…" : "Type a question, paste a screenshot, or use the microphone…"}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
                    disabled={busy || summaryBusy}
                  />
                  {screenshot && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-indigo-800/60 bg-indigo-950/30 px-3 py-2 text-xs text-indigo-200">
                      <span className="flex items-center gap-2"><FileImage className="h-4 w-4" /> Screenshot ready for analysis</span>
                      <button type="button" onClick={() => setScreenshot("")} aria-label="Remove screenshot"><X className="h-4 w-4" /></button>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSpeechInput}
                      disabled={busy}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${isListening ? "border-red-700 bg-red-950/50 text-red-200" : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? "Stop dictation" : "Speak"}
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700">
                      <Clipboard className="h-4 w-4" /> Add screenshot
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => { void acceptImage(event.target.files?.[0]); event.currentTarget.value = "" }}
                    />
                    <span className="flex-1 text-xs text-zinc-500">You can also paste an image anywhere in this workspace.</span>
                    {isMock && transcript.length === 0 ? (
                      <button type="button" onClick={askMockQuestion} disabled={busy} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                        Ask question <Sparkles className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="submit" disabled={busy || (!question.trim() && !screenshot)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isMock ? "Submit answer" : "Get answer"}
                      </button>
                    )}
                  </div>
                  {!recognitionAvailable && <p className="mt-2 text-xs text-amber-300">Speech input is unavailable in this browser. You can still type your question.</p>}
                </form>
                {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
              </div>

              {result && (
                <div className={cardClass}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-200"><Sparkles className="h-4 w-4" /> PitchPilot response</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{result.summary || "No summary was returned."}</p>
                  {result.starAnswer && Object.values(result.starAnswer).some(Boolean) && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {(["situation", "task", "action", "result"] as const).map((part) => result.starAnswer?.[part] && (
                        <div key={part} className="rounded-xl border border-indigo-900/60 bg-indigo-950/20 p-3">
                          <h3 className="mb-1 text-xs font-bold uppercase text-indigo-300">{part}</h3>
                          <p className="text-sm text-zinc-200">{result.starAnswer?.[part]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.codingSolution?.code && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-300">Coding solution · {result.codingSolution.language || "code"}</h3>
                      <pre className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-xs leading-5 text-zinc-200"><code>{result.codingSolution.code}</code></pre>
                      <p className="mt-2 text-xs text-zinc-400">Time: {result.codingSolution.timeComplexity || "—"} · Space: {result.codingSolution.spaceComplexity || "—"}</p>
                    </div>
                  )}
                  {result.mermaidChart && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-300">Mermaid diagram</h3>
                      <MermaidPreview source={result.mermaidChart} />
                      <pre className="overflow-x-auto rounded-xl border border-cyan-900/60 bg-zinc-950 p-4 text-xs leading-5 text-cyan-100"><code>{result.mermaidChart}</code></pre>
                    </div>
                  )}
                  {!!result.suggestedPhrases?.length && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">Suggested talking points</h3>
                      <ul className="space-y-2">{result.suggestedPhrases.map((phrase, index) => <li key={`${phrase}-${index}`} className="rounded-lg bg-zinc-950/60 p-3 text-sm text-zinc-200">“{phrase}”</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {summary && (
            <div className={cardClass}>
              <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-300"><CheckCircle className="h-5 w-5" /> Post-session summary</div>
              {summary.scorecard && (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["overallScore", summary.scorecard.overallScore],
                    ["technicalAccuracy", summary.scorecard.technicalAccuracy],
                    ["communicationClarity", summary.scorecard.communicationClarity],
                    ["problemSolving", summary.scorecard.problemSolving],
                  ] as const).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-zinc-950 p-3 text-center">
                      <div className="text-xl font-bold text-indigo-300">{value ?? "—"}</div>
                      <div className="mt-1 text-[10px] uppercase text-zinc-500">{key.replace(/([A-Z])/g, " $1")}</div>
                    </div>
                  ))}
                </div>
              )}
              {summary.scorecard?.verdict && <p className="mb-3 text-sm font-semibold text-emerald-200">Verdict: {summary.scorecard.verdict}</p>}
              {summary.aiNotes && <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{summary.aiNotes}</p>}
              {summary.followUpEmail && <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-indigo-300">View follow-up email draft</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-sm text-zinc-300">{summary.followUpEmail}</pre></details>}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className={`${cardClass} flex min-h-72 flex-col`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Session transcript</h2>
              <span className="text-xs text-zinc-500">{transcript.length} entries</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {transcript.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">Your questions, spoken input, and AI responses will appear here.</p>
              ) : transcript.map((entry, index) => (
                <div key={`${index}-${entry.speaker}`} className={`rounded-xl border p-3 text-sm ${entry.speaker === "You" ? "border-zinc-700 bg-zinc-950/70 text-zinc-300" : "border-emerald-900/50 bg-emerald-950/20 text-emerald-100"}`}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{entry.speaker}</div>
                  <p className="whitespace-pre-wrap leading-5">{entry.text}</p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-2 font-semibold">Finish session</h2>
            <p className="mb-4 text-xs leading-5 text-zinc-400">Save this conversation and generate AI notes, a scorecard, and a follow-up email draft.</p>
            <button onClick={generateSummary} disabled={busy || summaryBusy || !session || transcript.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {summaryBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {summaryBusy ? "Generating summary…" : summary ? "Refresh post-session summary" : "Generate post-session summary"}
            </button>
            {!transcript.length && <p className="mt-2 text-center text-xs text-zinc-500">Add at least one exchange to generate a summary.</p>}
          </div>
        </aside>
      </main>
    </div>
  )
}
