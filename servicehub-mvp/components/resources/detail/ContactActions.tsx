'use client'

import { useState } from 'react'
import { Phone, Mail, Copy, ExternalLink, Check } from 'lucide-react'
import { showToast } from '@/lib/toast'

/**
 * Call and email-draft buttons for a resource (Odosa: "Add an option to
 * contact them with buttons for both call & make an email draft. For email,
 * add an option to create draft email with a rewritten template").
 *
 * Why a drafted email rather than a bare mailto: link. Writing the first
 * message to a service provider is a real barrier -- you have to decide what
 * to ask, how formal to be, and how much to disclose, all before you have
 * learned anything. That blank-page moment is where people give up, and it is
 * precisely the executive-function load this product exists to take off
 * someone. A draft that is already 90% right turns the task into editing,
 * which is far cheaper than composing.
 *
 * The drafts are generated from real fields on this resource -- its name, its
 * category, the purpose the person picked -- not from a language model. That
 * keeps them instant, free, available offline, and incapable of inventing a
 * detail about a service we do not actually know. "Rewritten" here means
 * rewritten FOR this resource and this purpose, which is what makes a template
 * worth having; it does not mean guessed.
 *
 * The draft is editable in place before it leaves, because a mailto: body
 * cannot be revised once it reaches the mail client, and several clients
 * mangle or truncate long pre-filled bodies. Copy-to-clipboard is offered
 * beside it for exactly that reason: on a machine with no mail client
 * configured, mailto: does nothing at all, and a person should not be left
 * with a button that silently fails.
 */

export interface ContactActionsProps {
  resourceName: string
  category?: string | null
  phone?: string | null
  email?: string | null
}

type PurposeKey = 'accommodations' | 'availability' | 'cost' | 'intro'

const PURPOSES: { key: PurposeKey; label: string; describe: string }[] = [
  {
    key: 'accommodations',
    label: 'Ask about accommodations',
    describe: 'What they can adjust, and how to request it',
  },
  {
    key: 'availability',
    label: 'Ask about availability',
    describe: 'Whether they are taking people on, and any waitlist',
  },
  { key: 'cost', label: 'Ask about cost', describe: 'Fees, coverage and funding' },
  { key: 'intro', label: 'General enquiry', describe: 'A short first message' },
]

function buildDraft(purpose: PurposeKey, name: string, category?: string | null) {
  const service = category ? `your ${category.replace(/_/g, ' ')} service` : 'your service'

  switch (purpose) {
    case 'accommodations':
      return {
        subject: `Accommodations at ${name}`,
        body:
          `Hello,\n\n` +
          `I'm looking into ${service} and I'd like to know what accommodations you can offer.\n\n` +
          `In particular I'd like to ask about:\n` +
          `- Whether a quieter space or a quieter time of day is possible\n` +
          `- What the waiting area and first appointment are usually like\n` +
          `- Whether I can bring someone with me\n` +
          `- How I go about requesting an adjustment\n\n` +
          `If it's easier to answer by email than by phone, that works better for me.\n\n` +
          `Thank you for your time.`,
      }
    case 'availability':
      return {
        subject: `Availability at ${name}`,
        body:
          `Hello,\n\n` +
          `I'd like to find out whether you're currently taking on new people for ${service}.\n\n` +
          `If you are, could you let me know:\n` +
          `- How long the wait is at the moment\n` +
          `- What I need to have ready before a first appointment\n` +
          `- Whether I need a referral\n\n` +
          `If there's a waitlist, I'd like to be added to it.\n\n` +
          `Thank you.`,
      }
    case 'cost':
      return {
        subject: `Cost and coverage — ${name}`,
        body:
          `Hello,\n\n` +
          `I'm interested in ${service} and I'd like to understand the cost before I book.\n\n` +
          `Could you tell me:\n` +
          `- What you charge, and whether that's per session\n` +
          `- Whether you're covered by insurance or any funding programme\n` +
          `- Whether you offer a sliding scale or reduced rate\n\n` +
          `Thank you.`,
      }
    case 'intro':
    default:
      return {
        subject: `Enquiry — ${name}`,
        body:
          `Hello,\n\n` +
          `I found ${name} and I'd like to know more about ${service}.\n\n` +
          `Could you tell me how to get started, and what to expect from a first appointment?\n\n` +
          `Thank you.`,
      }
  }
}

export default function ContactActions({
  resourceName,
  category,
  phone,
  email,
}: ContactActionsProps) {
  const [open, setOpen] = useState(false)
  const [purpose, setPurpose] = useState<PurposeKey>('accommodations')
  const initial = buildDraft('accommodations', resourceName, category)
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [copied, setCopied] = useState(false)

  // Switching purpose rewrites the draft. Any edits are replaced, which is the
  // expected behaviour when you deliberately pick a different template.
  const choosePurpose = (key: PurposeKey) => {
    const next = buildDraft(key, resourceName, category)
    setPurpose(key)
    setSubject(next.subject)
    setBody(next.body)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      setCopied(true)
      showToast.success('Draft copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  if (!phone && !email) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call {phone}
          </a>
        )}
        {email && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {open ? 'Hide email draft' : 'Write an email'}
          </button>
        )}
      </div>

      {email && open && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">
              What do you want to ask?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PURPOSES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => choosePurpose(p.key)}
                  aria-pressed={purpose === p.key}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    purpose === p.key
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs text-gray-500">{p.describe}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="contact-subject"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Subject
            </label>
            <input
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="contact-body" className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              id="contact-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is a starting point — change anything that doesn&apos;t sound like you. You
              never have to explain why you&apos;re asking.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in email app
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy draft'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Sending to <span className="font-medium text-gray-700">{email}</span>. If the button
            does nothing, your device has no email app set up — copy the draft instead.
          </p>
        </div>
      )}
    </div>
  )
}
