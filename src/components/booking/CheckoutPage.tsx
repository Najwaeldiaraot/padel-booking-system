import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, QrCode, ShieldCheck, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { generateFallbackQrisString } from "@/lib/midtrans"
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
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
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

  // Polling payment status automatically for real-time Midtrans Sandbox confirmation
  useEffect(() => {
    if (!booking || booking.status !== "pending_payment" || !payment) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status?orderId=${booking.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === "confirmed") {
            clearInterval(interval)
            await refresh()
            navigate(`/confirmation/${booking.id}`, { replace: true })
          }
        }
      } catch {
        // non-blocking polling
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [booking, payment, refresh, navigate])

  const checkPaymentStatus = async () => {
    if (!booking) return
    setCheckingStatus(true)
    setError("")
    try {
      const res = await fetch(`/api/payment/status?orderId=${booking.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.status === "confirmed") {
          await refresh()
          navigate(`/confirmation/${booking.id}`, { replace: true })
          return
        } else if (data.status === "expired") {
          setError("Transaksi di Midtrans telah kedaluwarsa (melebihi 15 menit). Silakan ulangi booking atau gunakan tombol simulasi instan di bawah.")
        } else {
          setError("Pembayaran belum terdeteksi settlement di Midtrans. Jika sudah klik 'Pay' di simulator, tunggu beberapa saat atau gunakan tombol 'Bayar QRIS Instan'.")
        }
      }
    } catch {
      setError("Gagal memeriksa status ke Midtrans.")
    } finally {
      setCheckingStatus(false)
    }
  }
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
                    const effectiveQr = payment.qrString || generateFallbackQrisString(payment.bookingId, payment.amount)
                    const qrImgSrc = payment.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(effectiveQr)}`

                    return (
                      <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/20 p-5 text-center">
                        <div className="mb-2 flex items-center gap-1.5 rounded bg-emerald-700/10 px-2.5 py-1 text-2xs font-semibold uppercase text-emerald-800">
                          <QrCode size={13} />
                          QRIS Standar Nasional (Midtrans Sandbox)
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrImgSrc}
                          alt="QRIS Code"
                          width={180}
                          height={180}
                          className="my-3 rounded-lg border border-border bg-white p-2 shadow-sm"
                        />
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(effectiveQr)
                              setCopiedQr(true)
                              setTimeout(() => setCopiedQr(false), 2000)
                            }}
                            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-2xs font-medium text-foreground transition hover:bg-secondary"
                          >
                            {copiedQr ? <><Check size={12} className="text-emerald-600" /> String QR Disalin</> : <><Copy size={12} /> Salin QR String (EMVCo)</>}
                          </button>

                          {payment.qrImageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(payment.qrImageUrl!)
                                setCopiedUrl(true)
                                setTimeout(() => setCopiedUrl(false), 2000)
                              }}
                              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-2xs font-medium text-foreground transition hover:bg-secondary"
                            >
                              {copiedUrl ? <><Check size={12} className="text-emerald-600" /> URL Disalin</> : <><ExternalLink size={12} /> Salin URL Gambar QR</>}
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col items-center gap-2">
                          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                            Buka <a href="https://simulator.sandbox.midtrans.com/qris/index" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Midtrans Simulator QRIS ↗</a> lalu scan QR atau paste URL / string QRIS di atas.
                          </p>
                          <button
                            type="button"
                            disabled={checkingStatus}
                            onClick={checkPaymentStatus}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition cursor-pointer"
                          >
                            {checkingStatus ? <Spinner label="Memeriksa status…" className="text-primary" /> : <>🔄 Cek Status Pembayaran (Midtrans)</>}
                          </button>
                        </div>

                        <p className="mt-3 text-2xs text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded p-2 max-w-sm text-left leading-relaxed">
                          💡 <strong>Catatan Sandbox:</strong> QRIS Midtrans berlaku 15 menit. Jika muncul &quot;Transaction is unsuccessful&quot; di simulator, berarti transaksi tersebut sudah kedaluwarsa. Anda dapat klik tombol &quot;⚡ Bayar QRIS Instan&quot; di bawah untuk simulasi langsung.
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
