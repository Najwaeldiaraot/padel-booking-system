import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router"
import { ArrowRight, Eye, EyeOff, LogOut, MailCheck } from "lucide-react"
import { api, previewAccounts, type OtpChallenge } from "./api"
import { button, field, outlineButton, textLink, type User } from "./club"
import { errorMessage, useLocale } from "./i18n"
import { Modal, Spinner, formatCountdown, useCountdown } from "./ui"

type Mode = "login" | "register" | "otp"

export default function AuthDialog({
  open,
  close,
  user,
  onAuthenticated,
  onSignedOut,
}: {
  open: boolean
  close: () => void
  user: User | null
  onAuthenticated: (user: User) => void
  onSignedOut: () => void
}) {
  const { t } = useLocale()
  const [mode, setMode] = useState<Mode>("login")
  useEffect(() => {
    if (open) setMode("login")
  }, [open])
  const title = user
    ? t("Akun kamu", "Your account")
    : mode === "register"
      ? t("Buat akun pemain", "Create a player account")
      : mode === "otp"
        ? t("Cek kode verifikasi", "Check your code")
        : t("Masuk untuk booking", "Sign in to book")
  return (
    <Modal open={open} close={close} title={title} closeLabel={t("Tutup", "Close")}>
      {user ? (
        <Account user={user} close={close} onSignedOut={onSignedOut} />
      ) : (
        <AuthFlow mode={mode} setMode={setMode} onAuthenticated={onAuthenticated} />
      )}
    </Modal>
  )
}

function Account({ user, close, onSignedOut }: { user: User; close: () => void; onSignedOut: () => void }) {
  const { t } = useLocale()
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-5">
      <div className="border border-border bg-card p-5">
        <p className="font-display text-3xl">{user.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">{user.email || `+${user.phone}`}</p>
      </div>
      <Link to="/bookings" onClick={close} className={`${button} w-full`}>
        {t("Lihat booking saya", "View my bookings")} <ArrowRight size={16} />
      </Link>
      <button
        type="button"
        disabled={busy}
        className={`${outlineButton} w-full`}
        onClick={async () => {
          setBusy(true)
          await api.auth.logout("player")
          setBusy(false)
          onSignedOut()
        }}
      >
        <LogOut size={16} /> {t("Keluar", "Sign out")}
      </button>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative mt-2">
      <input
        required
        type={visible ? "text" : "password"}
        minLength={8}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${field} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? t("Sembunyikan kata sandi", "Hide password") : t("Tampilkan kata sandi", "Show password")}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

function AuthFlow({
  mode,
  setMode,
  onAuthenticated,
}: {
  mode: Mode
  setMode: (mode: Mode) => void
  onAuthenticated: (user: User) => void
}) {
  const { t } = useLocale()
  const [name, setName] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState("")
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const expiresIn = useCountdown(challenge?.expiresAt)
  const resendIn = useCountdown(challenge?.resendAt)
  const run = async (task: () => Promise<void>) => {
    setLoading(true)
    setError("")
    try {
      await task()
    } catch (problem) {
      setError(errorMessage(problem, t))
    } finally {
      setLoading(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === "login")
      run(async () => onAuthenticated(await api.auth.login({ identifier, password, scope: "player" })))
    else if (mode === "register")
      run(async () => {
        setChallenge(await api.auth.register({ name, identifier, password }))
        setCode("")
        setMode("otp")
      })
    else run(async () => onAuthenticated(await api.auth.verifyOtp({ challengeId: challenge!.challengeId, code })))
  }
  const strength = [password.length >= 8, /\d/.test(password), /[A-Za-z]/.test(password)].filter(Boolean).length
  if (mode === "otp" && challenge)
    return (
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-7 text-muted-foreground">
          {t("Kami mengirim 6 digit kode ke", "We sent a 6-digit code to")}{" "}
          <strong className="text-foreground">{challenge.destination}</strong>.{" "}
          {expiresIn > 0
            ? t(`Berlaku ${formatCountdown(expiresIn)}.`, `Valid for ${formatCountdown(expiresIn)}.`)
            : t("Kode sudah kedaluwarsa.", "The code has expired.")}
        </p>
        <div className="flex items-start gap-3 border border-border bg-secondary/60 p-4 text-xs leading-6">
          <MailCheck size={16} className="mt-1 shrink-0" aria-hidden="true" />
          <p>
            {t("Pratinjau pesan masuk", "Inbox preview")}: {t("kode verifikasi kamu", "your verification code is")}{" "}
            <strong className="font-mono text-sm tracking-widest">{challenge.preview}</strong>
          </p>
        </div>
        <input
          className={`${field} text-center font-mono text-xl tracking-[0.5em]`}
          aria-label={t("Kode OTP 6 digit", "6-digit code")}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          autoComplete="one-time-code"
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button disabled={loading || code.length !== 6} className={`${button} w-full`}>
          {loading ? <Spinner /> : <>{t("Verifikasi & masuk", "Verify & sign in")} <ArrowRight size={16} /></>}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={resendIn > 0 || loading}
            className={`${textLink} disabled:opacity-50`}
            onClick={() => run(async () => setChallenge(await api.auth.resendOtp(challenge.challengeId)))}
          >
            {resendIn > 0 ? t(`Kirim ulang dalam ${resendIn} dtk`, `Resend in ${resendIn}s`) : t("Kirim ulang kode", "Resend code")}
          </button>
          <button type="button" className={textLink} onClick={() => setMode("register")}>
            {t("Ubah data akun", "Edit account details")}
          </button>
        </div>
      </form>
    )
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-7 text-muted-foreground">
        {mode === "login"
          ? t("Simpan jadwal bermain, ubah jadwal sendiri, dan bagikan penilaianmu.", "Keep your games in one place, reschedule yourself, and share your rating.")
          : t("Daftar dengan email atau nomor HP. Kami akan mengirim kode verifikasi.", "Sign up with email or phone. We'll send a verification code.")}
      </p>
      {mode === "register" && (
        <label className="block text-sm">
          {t("Nama", "Name")}
          <input required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={`${field} mt-2`} />
        </label>
      )}
      <label className="block text-sm">
        {t("Email atau nomor HP", "Email or phone number")}
        <input
          required
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder={t("kamu@email.com atau 0812…", "you@email.com or +62 812…")}
          className={`${field} mt-2`}
        />
      </label>
      <label className="block text-sm">
        {t("Kata sandi", "Password")}
        <PasswordInput value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </label>
      {mode === "register" && (
        <>
          <div aria-live="polite" className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span key={index} className={`h-1 w-8 ${index < strength ? "bg-primary" : "bg-border"}`} />
              ))}
            </span>
            {t("Minimal 8 karakter, gabungkan huruf dan angka.", "At least 8 characters, mixing letters and numbers.")}
          </div>
          <label className="flex items-start gap-3 text-xs leading-6 text-muted-foreground">
            <input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1.5 accent-primary" />
            {t(
              "Saya menyetujui pengolahan data pribadi untuk booking sesuai kebijakan privasi klub.",
              "I agree to the processing of my personal data for bookings under the club's privacy policy.",
            )}
          </label>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button disabled={loading} className={`${button} w-full`}>
        {loading ? <Spinner /> : mode === "login" ? <>{t("Masuk", "Sign in")} <ArrowRight size={16} /></> : <>{t("Kirim kode verifikasi", "Send verification code")} <ArrowRight size={16} /></>}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? t("Belum punya akun?", "New here?") : t("Sudah punya akun?", "Already have an account?")}{" "}
        <button
          type="button"
          className="min-h-11 font-medium text-foreground underline underline-offset-4"
          onClick={() => {
            setError("")
            setMode(mode === "login" ? "register" : "login")
          }}
        >
          {mode === "login" ? t("Daftar", "Sign up") : t("Masuk", "Sign in")}
        </button>
      </p>
      {mode === "login" && (
        <details className="border-t border-border pt-4 text-xs text-muted-foreground">
          <summary className="min-h-11 cursor-pointer content-center">{t("Gunakan akun pratinjau", "Use a preview account")}</summary>
          <button
            type="button"
            className={`${outlineButton} mt-2 w-full`}
            onClick={() => {
              setIdentifier(previewAccounts[2].email)
              setPassword(previewAccounts[2].password)
            }}
          >
            {previewAccounts[2].email}
          </button>
        </details>
      )}
    </form>
  )
}
