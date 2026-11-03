import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, QrCode, ShieldCheck, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import {
  button,
  eyebrow,
  money,
  outlineButton,
  paymentMethods,
  textLink,
  useApp,
  type Booking,
  type Payment,
  type PaymentMethod,
} from "@/lib/club"
import { BookingPolicyNotice } from "./BookingSupport"
import { BookingSummary } from "./BookingParts"
import { errorMessage, useLocale } from "@/lib/i18n"
import { ErrorState, PageLoader, Spinner, formatCountdown, useCountdown, usePageTitle } from "@/components/ui"

export default function CheckoutPage() {
  const { id = "" } = useParams()
  const { club, user, openAuth, refresh } = useApp()
  const { t } = useLocale()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [method, setMethod] = useState<Exclude<PaymentMethod, "cash">>("qris")
  const [accepted, setAccepted] = useState(false)
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading")
  const [busy, setBusy] = useState<"" | "pay" | "success" | "failed" | "release">("")
  const [error, setError] = useState("")
  const [failed, setFailed] = useState(false)
  const [copiedQr, setCopiedQr] = useState(false)
  usePageTitle(t("Checkout", "Checkout"), club.name)
  const load = useCallback(async () => {
    if (!user) return
    try {
      const [current, payments] = await Promise.all([api.bookings.get(id), api.payments.forBooking(id)])
      setBooking(current)
      setPayment(payments.find((item) => item.status === "pending") || null)
      setFailed(payments[0]?.status === "failed")
      setState("ready")
    } catch {
      setState("missing")
    }
  }, [id, user])
  useEffect(() => {
    load()
  }, [load])
  const seconds = useCountdown(booking?.holdExpiresAt)
  useEffect(() => {
    if (booking?.holdExpiresAt && seconds === 0) load()
  }, [seconds, booking?.holdExpiresAt, load])
  useEffect(() => {
    if (booking?.status === "confirmed") navigate(`/confirmation/${booking.id}`, { replace: true })
  }, [booking, navigate])
  if (!user)
    return (
      <ErrorState
        title={t("Masuk untuk melanjutkan.", "Sign in to continue.")}
        description={t("Checkout tersimpan di akunmu. Masuk untuk melanjutkan pembayaran.", "Your checkout is saved to your account. Sign in to finish paying.")}
        action={<button type="button" className={button} onClick={() => openAuth()}>{t("Masuk", "Sign in")} <ArrowRight size={16} /></button>}
      />
    )
  if (state === "loading") return <PageLoader label={t("Memuat checkout…", "Loading checkout…")} />
  if (state === "missing" || !booking)
    return (
      <ErrorState
        title={t("Checkout tidak ditemukan.", "Checkout not found.")}
        description={t("Sesi ini mungkin sudah berakhir atau bukan milik akunmu.", "This session may have ended or belongs to another account.")}
        action={<Link to="/book" className={button}>{t("Pilih jadwal", "Choose a time")} <ArrowRight size={16} /></Link>}
      />
    )
  const expired = booking.status === "expired" || seconds === 0
  const run = async (kind: typeof busy, task: () => Promise<void>) => {
    setBusy(kind)
    setError("")
    try {
      await task()
    } catch (problem) {
      setError(errorMessage(problem, t))
      await load()
    } finally {
      setBusy("")
    }
  }
  const backToSchedule = `/book?court=${booking.court}&date=${booking.date}`
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 md:px-10">
      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          run("release", async () => {
            if (!expired) await api.bookings.release(booking.id)
            await refresh()
            navigate(backToSchedule)
          })
        }
        className={`${textLink} text-muted-foreground`}
      >
        <ArrowLeft size={14} /> {t("Ubah jadwal", "Change time")}
      </button>
      <p className={`${eyebrow} mt-8 text-sage`}>{t("Sedikit lagi sampai lapangan", "Almost on court")}</p>
      <h1 className="mt-4 font-display text-5xl md:text-6xl">
        {expired
          ? t("Waktu checkout habis.", "Checkout has expired.")
          : payment
            ? t("Selesaikan pembayaran.", "Complete your payment.")
            : t("Konfirmasi permainanmu.", "Confirm your game.")}
      </h1>
      <div className="mt-9 grid items-start gap-8 md:grid-cols-[1fr_360px]">
        <div>
          <div
            role="timer"
            aria-live="off"
            className={`flex items-center justify-between gap-4 border p-4 text-xs ${expired ? "border-destructive text-destructive" : "border-border bg-secondary"}`}
          >
            <span className="flex items-center gap-2">
              <Clock3 size={16} aria-hidden="true" />
              {expired ? t("Slot sudah dilepas.", "Your slot has been released.") : t("Slot ditahan untukmu", "Your slot is held")}
            </span>
            <span className="font-mono text-base">{formatCountdown(seconds)}</span>
          </div>
          {error && <p role="alert" className="mt-5 border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">{error}</p>}
          {expired ? (
            <div className="mt-7">
              <p className="text-sm leading-7 text-muted-foreground">
                {t(`Pembayaran belum selesai dalam ${club.policy.holdMinutes} menit, jadi slot dibuka kembali untuk pemain lain.`, `Payment wasn't completed within ${club.policy.holdMinutes} minutes, so the slot reopened for other players.`)}
              </p>
              <Link to={backToSchedule} className={`${button} mt-6`}>{t("Pilih slot lagi", "Pick a slot again")} <ArrowRight size={15} /></Link>
            </div>
          ) : payment ? (
            <div className="mt-7">
              <h2 className="font-display text-3xl">{t("Menunggu pembayaran", "Awaiting payment")}</h2>
              <div className="mt-5 border border-border bg-card p-6">
                <p className="text-sm font-medium">{paymentMethods.find((item) => item.id === payment.method)?.label}</p>
                {payment.method === "qris" ? (
                  (() => {
                    const fallbackEmvco = `00020101021226590014ID.LINKAJA.WWW011893600911002209355702150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID10200210000020303UMI520458125303360540${String(payment.amount).length}${payment.amount}5802ID5916Rally Padel Club6015Jakarta Selatan61051273062200116${payment.bookingId.slice(0, 16)}6304ABCD`
                    const effectiveQr = payment.qrString || fallbackEmvco
                    const qrImgSrc = payment.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(effectiveQr)}`

                    return (
                      <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/20 p-5 text-center">
                        <div className="mb-2 flex items-center gap-1.5 rounded bg-clay/10 px-2.5 py-1 text-2xs font-semibold uppercase text-clay">
                          <QrCode size={13} />
                          QRIS Standar Nasional (Sandbox)
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrImgSrc}
                          alt="QRIS Code"
                          width={180}
                          height={180}
                          className="my-3 rounded-lg border border-border bg-white p-2 shadow-sm"
                        />
                        <div className="mt-1 flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(effectiveQr)
                              setCopiedQr(true)
                              setTimeout(() => setCopiedQr(false), 2000)
                            }}
                            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-2xs font-medium text-foreground transition hover:bg-secondary"
                          >
                            {copiedQr ? <><Check size={12} className="text-emerald-600" /> Berhasil Disalin</> : <><Copy size={12} /> Salin QR String (EMVCo)</>}
                          </button>
                          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            Buka <a href="https://simulator.sandbox.midtrans.com/qris/index" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Midtrans Simulator QRIS ↗</a> lalu scan QR di atas atau paste string QRIS.
                          </p>
                        </div>
                        <p className="mt-2 text-2xs text-muted-foreground/80">
                          (Mode Sandbox: Saldo BCA/e-wallet Anda tidak akan terpotong)
                        </p>
                      </div>
                    )
                  })()
                ) : payment.instructions ? (
                  <>
                    <p className={`${eyebrow} mt-5 text-muted-foreground`}>{t("Nomor virtual account", "Virtual account number")}</p>
                    <p className="mt-2 font-mono text-2xl tracking-wider">{payment.instructions}</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {t("Buka aplikasi e-wallet di ponselmu untuk menyetujui pembayaran.", "Open your e-wallet app to approve the payment.")}
                  </p>
                )}
                <div className="mt-5 flex justify-between border-t border-border pt-4 text-sm">
                  <span>{t("Jumlah", "Amount")}</span>
                  <strong>{money(payment.amount)}</strong>
                </div>
                <p className="mt-2 text-2xs text-muted-foreground">{t("Referensi", "Reference")} {payment.gatewayRef}</p>
              </div>
              <div className="mt-6 border border-dashed border-border p-5">
                <p className={`${eyebrow} text-clay`}>{t("Simulasi gateway", "Gateway simulation")}</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {t("Pratinjau ini belum terhubung ke payment gateway. Pilih hasil pembayaran untuk melanjutkan alur.", "This preview isn't connected to a payment gateway yet. Choose an outcome to continue the flow.")}
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    run("success", async () => {
                      const result = await api.payments.simulateWebhook(payment.id, "success")
                      await refresh()
                      navigate(`/confirmation/${result.booking.id}`, { replace: true })
                    })
                  }
                  className={`${button} mt-4 w-full`}
                >
                  {busy === "success" ? <Spinner label={t("Mengonfirmasi…", "Confirming…")} className="text-primary-foreground" /> : <>{payment.method === "qris" ? "⚡ Bayar QRIS Instan (Simulasi Berhasil)" : t("Pembayaran berhasil", "Payment succeeds")} <CheckCircle2 size={16} /></>}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    run("failed", async () => {
                      await api.payments.simulateWebhook(payment.id, "failed")
                      setPayment(null)
                      setFailed(true)
                      await refresh()
                    })
                  }
                  className={`${outlineButton} mt-3 w-full`}
                >
                  {t("Pembayaran gagal", "Payment fails")}
                </button>
              </div>
              <button type="button" disabled={!!busy} onClick={() => setPayment(null)} className={`${textLink} mt-3`}>
                {t("Ganti metode pembayaran", "Use another method")}
              </button>
            </div>
          ) : (
            <div className="mt-7">
              {failed && (
                <p role="alert" className="mb-5 border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
                  {t("Pembayaran belum berhasil. Pilih metode lain atau coba lagi sebelum waktu habis.", "The payment didn't go through. Try again or pick another method before time runs out.")}
                </p>
              )}
              <h2 className="font-display text-3xl">{t("Metode pembayaran", "Payment method")}</h2>
              <fieldset className="mt-5 space-y-3">
                <legend className="sr-only">{t("Metode pembayaran", "Payment method")}</legend>
                {paymentMethods.map((item) => (
                  <label key={item.id} className={`flex min-h-16 cursor-pointer items-center gap-3 border bg-card px-4 ${method === item.id ? "border-primary" : "border-border"}`}>
                    <input type="radio" name="payment" value={item.id} checked={method === item.id} onChange={() => setMethod(item.id)} className="accent-primary" />
                    <CreditCard size={17} aria-hidden="true" />
                    <span className="text-sm">{item.label}</span>
                    <span className="ml-auto text-2xs text-muted-foreground">{item.kind === "va" ? "Virtual account" : "E-wallet"}</span>
                    {method === item.id && <Check size={17} aria-hidden="true" />}
                  </label>
                ))}
              </fieldset>
              <div className="mt-6">
                <BookingPolicyNotice />
              </div>
              <label className="mt-6 flex items-start gap-3 text-xs leading-6 text-muted-foreground">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1.5 accent-primary" />
                {t("Saya telah membaca ketentuan booking di atas.", "I've read the booking terms above.")}
              </label>
              <button
                type="button"
                disabled={!accepted || !!busy}
                onClick={() => run("pay", async () => setPayment(await api.payments.checkout(booking.id, method)))}
                className={`${button} mt-5 w-full`}
              >
                {busy === "pay" ? <Spinner label={t("Menyiapkan pembayaran…", "Preparing payment…")} className="text-primary-foreground" /> : <>{t("Bayar", "Pay")} {money(booking.total)} <ArrowRight size={15} /></>}
              </button>
              <p className="mt-4 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
                <ShieldCheck size={13} aria-hidden="true" />
                {t("Pembayaran simulasi · Tidak ada dana yang ditagih", "Simulated payment · No money is charged")}
              </p>
            </div>
          )}
        </div>
        <BookingSummary booking={booking} venue={club} />
      </div>
    </div>
  )
}
