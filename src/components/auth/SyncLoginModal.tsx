import { useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * Listens to db.cloud.userInteraction and renders the appropriate prompt
 * (email input → OTP code → done). This handles the full Dexie Cloud OTP login
 * flow in-app, with no browser popup required — works in both Tauri and the PWA.
 */
export function SyncLoginModal() {
  const interaction = useObservable(db.cloud.userInteraction)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  if (!interaction) return null

  if (interaction.type === 'email') {
    return (
      <Modal open onClose={() => interaction.onCancel()} title={interaction.title}>
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
            <Button variant="ghost" onClick={() => interaction.onCancel()}>Cancel</Button>
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
      <Modal open onClose={() => interaction.onCancel()} title={interaction.title}>
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
            <Button variant="ghost" onClick={() => interaction.onCancel()}>Back</Button>
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
      <Modal open onClose={() => interaction.onSubmit({})} title={interaction.title}>
        <div className="flex flex-col gap-4">
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-gray-300">{a.message}</p>
          ))}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => interaction.onSubmit({})}>{interaction.submitLabel}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (interaction.type === 'logout-confirmation') {
    return (
      <Modal open onClose={() => interaction.onCancel()} title={interaction.title}>
        <div className="flex flex-col gap-4">
          {interaction.alerts.map((a, i) => (
            <p key={i} className="text-sm text-gray-400">{a.message}</p>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => interaction.onCancel()}>{interaction.cancelLabel}</Button>
            <Button variant="danger" onClick={() => interaction.onSubmit({})}>{interaction.submitLabel}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return null
}
