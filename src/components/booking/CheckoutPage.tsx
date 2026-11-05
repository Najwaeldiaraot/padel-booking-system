import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, QrCode, RefreshCw, ShieldCheck, Sparkles, Zap } from "lucide-react"
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
  const [simulatingPay, setSimulatingPay] = useState(false)
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

  const handleSimulatePay = async () => {
    if (!booking) return
    setSimulatingPay(true)
    setError("")
    try {
      const res = await fetch("/api/payment/simulate-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: booking.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses pembayaran otomatis di Midtrans Sandbox")
      }
      await refresh()
      navigate(`/confirmation/${booking.id}`, { replace: true })
    } catch (err: any) {
      setError(err.message || "Gagal melakukan pembayaran otomatis via Midtrans Sandbox")
    } finally {
      setSimulatingPay(false)
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
            className={`flex items-center justify-between gap-4 border p-4 text-xs shadow-xs ${
              expired ? "border-destructive/40 bg-danger-soft text-destructive" : "border-border bg-white text-foreground"
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              <Clock3 size={16} className={expired ? "text-destructive" : "text-primary"} aria-hidden="true" />
              {expired ? t("Slot sudah dilepas.", "Your slot has been released.") : t("Slot ditahan untukmu", "Your slot is held")}
            </span>
            <span className="font-mono text-base font-semibold">{formatCountdown(seconds)}</span>
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
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("Menunggu pembayaran", "Awaiting payment")}</h2>
              <div className="mt-5 border border-border bg-card p-6 sm:p-8">
                {/* Clean Header: Payment Method & Total (Clean modern sans-serif) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <span className="text-2xs font-semibold uppercase tracking-widest text-primary block">
                      Metode Pembayaran
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {paymentMethods.find((item) => item.id === payment.method)?.label}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs uppercase tracking-wider text-muted-foreground block">
                      Total Tagihan
                    </span>
                    <span className="text-base sm:text-lg font-bold text-foreground">
                      {money(payment.amount)}
                    </span>
                  </div>
                </div>

                {payment.method === "qris" ? (
                  (() => {
                    const effectiveQr = payment.qrString || generateFallbackQrisString(payment.bookingId, payment.amount)
                    const qrImgSrc = payment.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(effectiveQr)}`

                    return (
                      <div className="py-6 flex flex-col items-center justify-center text-center">
                        {/* QR Code - Direct image without nested card wrappers */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrImgSrc}
                          alt="QRIS Code"
                          width={220}
                          height={220}
                          className="block size-52 sm:size-56 rounded-md shadow-xs bg-white"
                        />

                        <p className="mt-3.5 text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <QrCode size={14} className="text-primary shrink-0" />
                          Scan menggunakan BCA, GoPay, ShopeePay, Dana, OVO, atau m-Banking
                        </p>

                        {/* Clean Actions without Emojis */}
                        <div className="mt-6 w-full max-w-sm space-y-2.5">
                          <button
                            type="button"
                            disabled={simulatingPay || !!busy}
                            onClick={handleSimulatePay}
                            className={`${button} w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center gap-2 text-xs font-semibold shadow-xs cursor-pointer`}
                          >
                            {simulatingPay ? (
                              <Spinner label="Menyelesaikan pembayaran di Midtrans…" className="text-white" />
                            ) : (
                              <>
                                <Zap size={14} className="fill-current text-amber-300" />
                                <span>Bayar Otomatis (Midtrans Sandbox)</span>
                              </>
                            )}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            {payment.qrImageUrl ? (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(payment.qrImageUrl!)
                                  setCopiedUrl(true)
                                  setTimeout(() => setCopiedUrl(false), 2000)
                                }}
                                className="inline-flex items-center justify-center gap-1.5 border border-border bg-background px-3 py-2 text-2xs font-medium text-foreground hover:bg-secondary transition cursor-pointer"
                              >
                                {copiedUrl ? (
                                  <>
                                    <Check size={12} className="text-emerald-600" />
                                    <span>URL Disalin</span>
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink size={12} />
                                    <span>Salin URL QR</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <div />
                            )}

                            <button
                              type="button"
                              disabled={checkingStatus}
                              onClick={checkPaymentStatus}
                              className="inline-flex items-center justify-center gap-1.5 border border-border bg-background px-3 py-2 text-2xs font-medium text-foreground hover:bg-secondary transition cursor-pointer"
                            >
                              {checkingStatus ? (
                                <Spinner label="Memeriksa…" className="text-primary" />
                              ) : (
                                <>
                                  <RefreshCw size={12} />
                                  <span>Cek Status</span>
                                </>
                              )}
                            </button>
                          </div>

                          <p className="pt-2 text-2xs text-muted-foreground leading-relaxed">
                            Ingin tes manual? Buka{" "}
                            <a
                              href="https://simulator.sandbox.midtrans.com/v2/qris/index"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary underline inline-flex items-center gap-0.5"
                            >
                              Midtrans Simulator v2
                              <ExternalLink size={10} />
                            </a>{" "}
                            lalu paste URL Gambar QR di atas.
                          </p>
                        </div>
                      </div>
                    )
                  })()
                ) : payment.instructions ? (
                  <div className="py-6">
                    <p className={`${eyebrow} text-muted-foreground`}>{t("Nomor virtual account", "Virtual account number")}</p>
                    <p className="mt-2 font-mono text-2xl tracking-wider">{payment.instructions}</p>
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
                      className={`${button} mt-6 w-full`}
                    >
                      {busy === "success" ? <Spinner label={t("Mengonfirmasi…", "Confirming…")} className="text-primary-foreground" /> : <>{t("Simulasikan Pembayaran Berhasil", "Simulate Payment Success")} <CheckCircle2 size={16} /></>}
                    </button>
                  </div>
                ) : (
                  <div className="py-6">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {t("Buka aplikasi e-wallet di ponselmu untuk menyetujui pembayaran.", "Open your e-wallet app to approve the payment.")}
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
                      className={`${button} mt-6 w-full`}
                    >
                      {busy === "success" ? <Spinner label={t("Mengonfirmasi…", "Confirming…")} className="text-primary-foreground" /> : <>{t("Simulasikan Pembayaran Berhasil", "Simulate Payment Success")} <CheckCircle2 size={16} /></>}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span>{t("Referensi", "Reference")} <span className="font-mono font-medium text-foreground">{payment.gatewayRef}</span></span>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setPayment(null)}
                    className={`${textLink} text-xs`}
                  >
                    {t("Ganti metode pembayaran", "Use another method")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-7">
              {failed && (
                <p role="alert" className="mb-5 border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
                  {t("Pembayaran belum berhasil. Pilih metode lain atau coba lagi sebelum waktu habis.", "The payment didn't go through. Try again or pick another method before time runs out.")}
                </p>
              )}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("Metode pembayaran", "Payment method")}</h2>
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
