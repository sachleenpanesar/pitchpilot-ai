import nodemailer from "nodemailer"
import { Resend } from "resend"

const DEFAULT_FROM = "PitchPilot AI <onboarding@resend.dev>"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const gmailUser = process.env.GMAIL_USER
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD
  let gmailError: string | null = null

  if (gmailUser && gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || gmailUser,
        to,
        subject,
        html,
      })
      return
    } catch (error) {
      gmailError = getErrorMessage(error)
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    if (gmailError) {
      console.warn("Gmail SMTP delivery failed; attempting Resend fallback.", {
        error: gmailError,
      })
    }

    try {
      const resend = new Resend(apiKey)
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to,
        subject,
        html,
      })

      if (error) {
        throw new Error(error.message || "Email provider rejected the message")
      }
      return
    } catch (error) {
      const resendError = getErrorMessage(error)
      if (gmailError) {
        throw new Error(`Email delivery failed via Gmail SMTP and Resend. Gmail: ${gmailError}; Resend: ${resendError}`)
      }
      throw new Error(`Email delivery failed via Resend: ${resendError}`)
    }
  }

  if (gmailError) {
    throw new Error(`Email delivery failed via Gmail SMTP: ${gmailError}`)
  }
  if (gmailUser || gmailAppPassword) {
    throw new Error("Gmail SMTP is incomplete; configure both GMAIL_USER and GMAIL_APP_PASSWORD.")
  }
  throw new Error("No email provider is configured; set Gmail SMTP credentials or RESEND_API_KEY.")
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const safeName = escapeHtml(name)
  await sendEmail(
    to,
    "Welcome to PitchPilot AI",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#172033">
      <div style="padding:28px;background:#111827;color:#fff;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:24px">Welcome to PitchPilot AI</h1>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
        <p>Hi ${safeName},</p>
        <p>Your account is ready. PitchPilot AI is here to help you prepare for interviews and important conversations.</p>
        <p>Good luck, and welcome aboard!</p>
        <p style="color:#64748b">— The PitchPilot AI team</p>
      </div>
    </div>`,
  )
}

export async function sendLoginOtpEmail(to: string, code: string): Promise<void> {
  await sendEmail(
    to,
    "Your PitchPilot AI login code",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#172033">
      <div style="padding:28px;background:#111827;color:#fff;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:24px">Sign in to PitchPilot AI</h1>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
        <p>Use this one-time code to finish signing in:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4338ca">${escapeHtml(code)}</p>
        <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
        <p style="color:#64748b">— The PitchPilot AI team</p>
      </div>
    </div>`,
  )
}

export async function sendSupportTicketAlert(input: {
  ticketId: string
  customerName: string | null
  customerEmail: string
  subject: string
  message: string
}): Promise<void> {
  const safeName = escapeHtml(input.customerName || "Customer")
  const safeEmail = escapeHtml(input.customerEmail)
  const safeSubject = escapeHtml(input.subject)
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>")
  const safeTicketId = escapeHtml(input.ticketId)

  await sendEmail(
    "sachleen49@gmail.com",
    `New support ticket: ${input.subject}`,
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#172033">
      <h1 style="font-size:22px">New support ticket</h1>
      <p><strong>Ticket:</strong> ${safeTicketId}</p>
      <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <p>${safeMessage}</p>
    </div>`,
  )
}
