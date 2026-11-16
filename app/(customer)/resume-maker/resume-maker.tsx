"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Download, FileText, LoaderCircle, Save, Sparkles } from "lucide-react"

type Resume = { id: string; title: string; content: string }

export default function ResumeMaker({
  initialResumes,
  initialCredits,
}: {
  initialResumes: Resume[]
  initialCredits: number
}) {
  const [resumes, setResumes] = useState(initialResumes)
  const [selectedId, setSelectedId] = useState(initialResumes[0]?.id ?? "")
  const [resumeText, setResumeText] = useState(initialResumes[0]?.content ?? "")
  const [jobDescription, setJobDescription] = useState("")
  const [tailoredResume, setTailoredResume] = useState("")
  const [documentId, setDocumentId] = useState("")
  const [notes, setNotes] = useState("")
  const [credits, setCredits] = useState(initialCredits)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  function chooseResume(id: string) {
    setSelectedId(id)
    setResumeText(resumes.find((resume) => resume.id === id)?.content ?? "")
  }

  async function saveResume(content: string, title: string, id?: string) {
    const response = await fetch(id ? `/api/documents/${id}` : "/api/documents", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, docType: "RESUME", content }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not save your resume.")
    const saved = id ? data.document : data
    setResumes((current) => [saved, ...current.filter((resume) => resume.id !== saved.id)])
    setSelectedId(saved.id)
    return saved.id as string
  }

  async function handleSaveSource() {
    setError("")
    setMessage("")
    setSaving(true)
    try {
      const currentTitle = resumes.find((resume) => resume.id === selectedId)?.title || "My resume"
      await saveResume(resumeText, currentTitle, selectedId || undefined)
      setMessage("Resume saved to your Career Vault.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your resume.")
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)
    try {
      const response = await fetch("/api/resume-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedId || undefined,
          resumeText,
          jobDescription,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Resume tailoring failed.")
      setTailoredResume(data.resume)
      setDocumentId(data.document.id)
      setNotes(data.notes || "")
      setCredits(data.credits)
      setMessage("Tailored resume saved to your Career Vault.")
      setResumes((current) => [
        { id: data.document.id, title: data.document.title, content: data.resume },
        ...current.filter((resume) => resume.id !== data.document.id),
      ])
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Resume tailoring failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdits() {
    setError("")
    setMessage("")
    setSaving(true)
    try {
      const id = await saveResume(tailoredResume, "Tailored resume", documentId || undefined)
      setDocumentId(id)
      setMessage("Your latest edits are saved.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save edits.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI Resume Maker</h1>
              <p className="mt-1 text-sm text-zinc-400">A role-specific resume, grounded in your real experience.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          <span className="text-zinc-500">Credits</span> <strong className="ml-2 text-indigo-300">{credits}</strong>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={handleGenerate} className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
          <div>
            <label htmlFor="saved-resume" className="mb-2 block text-sm font-medium text-zinc-200">Saved resume</label>
            <select
              id="saved-resume"
              value={selectedId}
              onChange={(event) => chooseResume(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            >
              <option value="">Paste a resume below</option>
              {resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}
            </select>
            {resumes.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500">No saved resumes yet. Paste your CV here, then save it to your Career Vault.</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="resume-source" className="text-sm font-medium text-zinc-200">Your resume</label>
              <span className="text-xs text-zinc-500">{resumeText.length.toLocaleString()} / 30,000</span>
            </div>
            <textarea
              id="resume-source"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              maxLength={30_000}
              rows={11}
              required
              placeholder="Paste your current resume, including experience, education, and skills…"
              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
            <button type="button" onClick={handleSaveSource} disabled={saving || !resumeText.trim()} className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-indigo-300 hover:text-indigo-200 disabled:opacity-50">
              {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save source resume
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="job-description" className="text-sm font-medium text-zinc-200">Target job description</label>
              <span className="text-xs text-zinc-500">{jobDescription.length.toLocaleString()} / 20,000</span>
            </div>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              maxLength={20_000}
              rows={8}
              required
              placeholder="Paste the role, requirements, and responsibilities…"
              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</p>}

          <button type="submit" disabled={loading || !resumeText.trim() || !jobDescription.trim() || credits < 1} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Tailoring your resume…" : "Tailor resume · 1 credit"}
          </button>
          <p className="text-center text-xs text-zinc-500">AI preserves your facts and does not invent experience or qualifications.</p>
        </form>

        <section aria-labelledby="preview-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="preview-title" className="font-semibold text-white">Resume preview</h2>
              <p className="mt-1 text-xs text-zinc-500">Review and edit before printing. Your generated version is saved automatically.</p>
            </div>
            {tailoredResume && (
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveEdits} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
                  {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save edits
                </button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-200">
                  <Download className="h-3.5 w-3.5" /> Print / PDF
                </button>
              </div>
            )}
          </div>
          <div className="resume-print min-h-[720px] rounded-2xl border border-zinc-800 bg-white p-6 text-zinc-900 shadow-xl sm:p-10">
            {tailoredResume ? (
              <>
                {notes && (
                  <div className="mb-5 flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900 print:hidden">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {notes}
                  </div>
                )}
                <label htmlFor="tailored-output" className="sr-only">Edit tailored resume</label>
                <textarea
                  id="tailored-output"
                  value={tailoredResume}
                  onChange={(event) => setTailoredResume(event.target.value)}
                  rows={28}
                  className="min-h-[650px] w-full resize-y border-0 bg-transparent p-0 font-sans text-sm leading-7 text-zinc-900 focus:outline-none print:hidden"
                />
                <div className="hidden whitespace-pre-wrap font-sans text-sm leading-7 text-black print:block">{tailoredResume}</div>
              </>
            ) : (
              <div className="flex min-h-[650px] flex-col items-center justify-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                  <FileText className="h-6 w-6" />
                </span>
                <p className="font-medium text-zinc-800">Your tailored resume will appear here</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">Choose a saved CV, add the target role, then generate a clean, print-ready version.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
