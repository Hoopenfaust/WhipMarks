import { useEffect, useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

const LOGIN_TIMEOUT_MS = 8000

/**
 * Only rendered when the user explicitly taps "Sign in to sync".
 * Handles the full Dexie Cloud OTP login flow in-app — no browser popup.
 * Calls onDone() when login completes, fails, or the user cancels.
 */
export function SyncLoginModal({ onDone }: { onDone: () => void }) {
  const interaction = useObservable(db.cloud.userInteraction)
  const currentUser = useObservable(db.cloud.currentUser)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [timedOut, setTimedOut] = useState(false)

  // Trigger the login flow as soon as this component mounts
  useEffect(() => {
    db.cloud.login().catch(err => console.error('[WhipMarks sync] login() failed:', err))
  }, [])

  // Close automatically once logged in
  useEffect(() => {
    if (currentUser?.isLoggedIn) onDone()
  }, [currentUser?.isLoggedIn, onDone])

  // If Dexie Cloud never reaches the server (no network path to it), don't
  // leave the user staring at a click that visibly did nothing with no way
  // to back out — surface it and let them close the dialog.
  useEffect(() => {
    if (interaction) return
    const t = setTimeout(() => setTimedOut(true), LOGIN_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [interaction])

  if (!interaction) {
    if (!timedOut) return null
    return (
      <Modal open onClose={onDone} title="Sign in to sync">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-400">
            Can't reach the sync server after {LOGIN_TIMEOUT_MS / 1000}s. Check your internet connection — some
            networks (school/office WiFi in particular) block the connection sync needs — then try again.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onDone}>Close</Button>
          </div>
        </div>
      </Modal>
    )
  }

  function cancel() { interaction!.onCancel(); onDone() }

  if (interaction.type === 'email') {
    return (
      <Modal open onClose={cancel} title="Sign in to sync">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400">
            Enter your email address. We'll send a one-time code to sign you in.
          </p>
          <Input
            label="Email address"
            type="email"
            placeholder={interaction.fields.email.placeholder}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && email.trim() && interaction.onSubmit({ email: email.trim() })}
            autoFocus
          />
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-red-400">{a.message}</p>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => email.trim() && interaction.onSubmit({ email: email.trim() })}
              disabled={!email.trim()}
            >
              {interaction.submitLabel}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (interaction.type === 'otp') {
    return (
      <Modal open onClose={cancel} title="Check your email">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400">
            Check your email for a one-time code and enter it below.
          </p>
          <Input
            label={interaction.fields.otp.label}
            type="text"
            placeholder="123456"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && otp.trim() && interaction.onSubmit({ otp: otp.trim() })}
            autoFocus
          />
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-red-400">{a.message}</p>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => otp.trim() && interaction.onSubmit({ otp: otp.trim() })}
              disabled={!otp.trim()}
            >
              {interaction.submitLabel}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (interaction.type === 'message-alert') {
    return (
      <Modal open onClose={() => { interaction.onSubmit({}); onDone() }} title={interaction.title}>
        <div className="flex flex-col gap-4">
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-gray-300">{a.message}</p>
          ))}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => { interaction.onSubmit({}); onDone() }}>{interaction.submitLabel}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (interaction.type === 'logout-confirmation') {
    return (
      <Modal open onClose={cancel} title={interaction.title}>
        <div className="flex flex-col gap-4">
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-gray-400">{a.message}</p>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>{interaction.cancelLabel}</Button>
            <Button variant="danger" onClick={() => { interaction.onSubmit({}); onDone() }}>{interaction.submitLabel}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return null
}
