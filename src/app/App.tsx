import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router"
import { ArrowRight, ArrowUpRight, CheckCircle2, Menu, X } from "lucide-react"
import { motion, MotionConfig, useReducedMotion } from "motion/react"
import { api, subscribe } from "./api"
import { cinematicEase } from "./CinematicMotion"
import ClubHome from "./ClubHome"
import BookPage from "./BookPage"
import CheckoutPage from "./CheckoutPage"
import MyBookingsPage, { ConfirmationPage } from "./MyBookings"
import AuthDialog from "./AuthDialog"
import { BookingPolicyNotice } from "./BookingSupport"
import { NotificationsMenu } from "./BookingParts"
import {
  AppContext,
  button,
  defaultClub,
  eyebrow,
  ghostLightButton,
  outlineButton,
  today,
  toVenue,
  useApp,
  type AppNotification,
  type Booking,
  type BusySlot,
  type ClubConfig,
  type PublicReview,
  type User,
} from "./club"
import { LanguageSwitch, LocaleProvider, notificationText, useContent, useLocale } from "./i18n"
import { ErrorState, Modal, PageLoader, usePageTitle } from "./ui"

const AdminApp = lazy(() => import("./admin/AdminApp"))

function Root() {
  const reducedMotion = useReducedMotion()
  const { t, locale } = useLocale()
  const content = useContent()
  const [club, setClub] = useState<ClubConfig>(defaultClub)
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [date, setDate] = useState(today())
  const [authOpen, setAuthOpen] = useState(false)
  const [toast, setToast] = useState("")
  const [policyOpen, setPolicyOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const pendingAuth = useRef<(() => void) | undefined>(undefined)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isHome = location.pathname === "/"
  const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/")

  const refresh = useCallback(async () => {
    try {
      const [nextClub, nextBusy, nextReviews, nextUser] = await Promise.all([
        api.club.get(),
        api.availability(),
        api.reviews(),
        api.auth.me("player"),
      ])
      const [mine, notes] = nextUser
        ? await Promise.all([api.bookings.mine(), api.notifications.mine()])
        : [[], []]
      setClub(nextClub)
      setBusy(nextBusy)
      setReviews(nextReviews)
      setUser(nextUser)
      setMyBookings(mine)
      setNotifications(notes)
      setFailed(false)
      setReady(true)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => {
    refresh()
    const unsubscribe = subscribe(refresh)
    const timer = setInterval(refresh, 30000)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [refresh])
  useEffect(() => {
    setMobileMenu(false)
    if (location.hash)
      setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 100)
    else window.scrollTo(0, 0)
  }, [location.pathname, location.hash])
  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(""), 4000)
    return () => clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (!mobileMenu) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMobileMenu(false)
    const onClick = (event: MouseEvent) => !menuRef.current?.contains(event.target as Node) && setMobileMenu(false)
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [mobileMenu])
  const venue = toVenue(club)
  const openAuth = (onSuccess?: () => void) => {
    pendingAuth.current = onSuccess
    setMobileMenu(false)
    setAuthOpen(true)
  }
  const nav = [
    { to: "/#courts", label: t("Lapangan", "Courts") },
    { to: "/#facilities", label: t("Fasilitas", "Facilities") },
    { to: "/#visit", label: t("Lokasi", "Visit") },
    { to: "/#faq", label: "FAQ" },
    { to: "/bookings", label: t("Booking saya", "My bookings") },
  ]
  const accountLabel = user ? t(`Hai, ${user.name.split(" ")[0]}`, `Hi, ${user.name.split(" ")[0]}`) : t("Masuk / Daftar", "Sign in")
  return (
    <AppContext.Provider
      value={{ ready, club: venue, busy, reviews, user, myBookings, notifications, date, setDate, refresh, openAuth, notify: setToast }}
    >
      <MotionConfig reducedMotion="user" transition={{ duration: 0.75, ease: cinematicEase }}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-4">
          {t("Ke konten utama", "Skip to content")}
        </a>
        {!isAdmin && (
          <header
            className={`${isHome ? "absolute inset-x-0 top-0 border-b border-white/15 text-background" : "relative border-b border-border"} z-20`}
          >
            <div ref={menuRef} className="relative mx-auto flex h-24 max-w-[1600px] items-center justify-between gap-4 px-6 md:px-12 lg:px-16">
              <Link to="/" aria-label={t(`${club.name} beranda`, `${club.name} home`)} className="max-w-52 font-display text-3xl leading-none md:max-w-72 md:text-4xl lg:max-w-none lg:whitespace-nowrap">
                {club.name}
                <span className={isHome ? "text-sage-light" : "text-sage"}>.</span>
              </Link>
              <nav aria-label={t("Navigasi utama", "Main navigation")} className="hidden items-center gap-6 text-sm font-medium xl:flex">
                {nav.map((item) => (
                  <Link key={item.to} to={item.to} className="flex min-h-11 items-center underline-offset-8 transition hover:underline focus-visible:underline">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-2 md:gap-3">
                <LanguageSwitch className="hidden sm:flex" />
                {user && (
                  <NotificationsMenu
                    items={notifications}
                    describe={(item) => notificationText(item, t)}
                    onOpen={() => api.notifications.markRead()}
                    onItemClick={(item) => api.notifications.markItemRead(item.id)}
                    label={t("Notifikasi", "Notifications")}
                    emptyText={t("Belum ada notifikasi.", "No notifications yet.")}
                    tone={isHome ? "dark" : "light"}
                    locale={locale}
                  />
                )}
                {!isHome && (
                  <Link to="/book" className={`${button} max-md:!hidden`}>
                    {t("Booking sekarang", "Book now")} <ArrowUpRight size={16} />
                  </Link>
                )}
                <button
                  type="button"
                  className={`${isHome ? ghostLightButton : outlineButton} !min-h-12 max-sm:!hidden`}
                  onClick={() => openAuth()}
                >
                  {accountLabel}
                </button>
                <button
                  type="button"
                  aria-label={mobileMenu ? t("Tutup menu", "Close menu") : t("Buka menu", "Open menu")}
                  aria-expanded={mobileMenu}
                  onClick={() => setMobileMenu(!mobileMenu)}
                  className="flex size-11 items-center justify-center xl:hidden"
                >
                  {mobileMenu ? <X /> : <Menu />}
                </button>
              </div>
              {mobileMenu && (
                <nav
                  aria-label={t("Menu", "Menu")}
                  className="absolute top-22 right-4 left-4 z-30 flex flex-col border border-border bg-background p-6 text-primary shadow-xl sm:left-auto sm:w-80 xl:hidden"
                >
                  {nav.map((item) => (
                    <Link key={item.to} to={item.to} className="flex min-h-12 items-center border-b border-border text-sm">
                      {item.label}
                    </Link>
                  ))}
                  <Link to="/book" className={`${button} mt-5`}>{t("Booking sekarang", "Book now")} <ArrowRight size={16} /></Link>
                  <button type="button" className={`${outlineButton} mt-3`} onClick={() => openAuth()}>
                    {accountLabel}
                  </button>
                  <LanguageSwitch className="mt-4 justify-center" />
                </nav>
              )}
            </div>
          </header>
        )}
        <main id="main">
          {failed && !ready ? (
            <ErrorState
              title={t("Klub belum bisa dimuat.", "We couldn't load the club.")}
              description={t("Periksa koneksi lalu coba lagi.", "Check your connection and try again.")}
              action={<button type="button" className={button} onClick={refresh}>{t("Coba lagi", "Try again")}</button>}
            />
          ) : !ready ? (
            <PageLoader label={t("Menyiapkan lapangan…", "Getting the courts ready…")} />
          ) : (
            <motion.div
              key={location.pathname}
              initial={isHome || reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.65, ease: cinematicEase }}
            >
              <Outlet />
            </motion.div>
          )}
        </main>
        {!isAdmin && ready && (
          <footer className="mt-16 border-t border-border px-6 py-10 md:px-12 lg:px-16">
            <div className="mx-auto flex max-w-[1472px] flex-col justify-between gap-8 md:flex-row">
              <div>
                <Link to="/" className="font-display text-5xl">{club.name}.</Link>
                <p className="mt-3 text-sm text-muted-foreground">{content.club(club, "tagline")}</p>
              </div>
              <nav aria-label={t("Tautan footer", "Footer links")} className="flex flex-wrap items-start gap-x-6 text-xs">
                <Link to="/#club" className="flex min-h-11 items-center hover:underline">{t("Tentang klub", "About the club")}</Link>
                <button type="button" onClick={() => setPolicyOpen(true)} className="min-h-11 hover:underline">{t("Kebijakan booking", "Booking policy")}</button>
                <button type="button" onClick={() => setPrivacyOpen(true)} className="min-h-11 hover:underline">{t("Privasi", "Privacy")}</button>
                <Link to="/#faq" className="flex min-h-11 items-center hover:underline">{t("Bantuan & FAQ", "Help & FAQ")}</Link>
              </nav>
            </div>
            <div className="mx-auto mt-8 flex max-w-[1472px] flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-2xs text-muted-foreground">
              <span>© {new Date().getFullYear()} {club.name}. {t("Dibuat untuk cinta pada permainan.", "Made for the love of the game.")}</span>
              <span>{t("Pratinjau klub · Pembayaran belum aktif · WIB", "Club preview · Payments not live · WIB")} · {t("Foto", "Photos")}: Unsplash</span>
              <Link to="/admin" className="flex min-h-11 items-center underline underline-offset-4">{t("Area staf", "Staff area")}</Link>
            </div>
          </footer>
        )}
        {toast && (
          <div
            role="status"
            className="fixed top-4 right-4 left-4 z-50 mx-auto flex max-w-md items-center gap-3 bg-primary px-5 py-4 text-sm text-primary-foreground shadow-xl md:top-auto md:bottom-5"
          >
            <CheckCircle2 size={19} className="shrink-0" aria-hidden="true" />
            {toast}
          </div>
        )}
        <AuthDialog
          open={authOpen}
          close={() => setAuthOpen(false)}
          user={user}
          onAuthenticated={async (nextUser) => {
            setAuthOpen(false)
            await refresh()
            setToast(t(`Selamat datang, ${nextUser.name.split(" ")[0]}!`, `Welcome, ${nextUser.name.split(" ")[0]}!`))
            const next = pendingAuth.current
            pendingAuth.current = undefined
            next?.()
          }}
          onSignedOut={async () => {
            setAuthOpen(false)
            await refresh()
            setToast(t("Kamu sudah keluar. Sampai di rally berikutnya!", "You're signed out. See you next rally!"))
          }}
        />
        <Modal open={policyOpen} close={() => setPolicyOpen(false)} title={t("Kebijakan booking", "Booking policy")} closeLabel={t("Tutup", "Close")}>
          <BookingPolicyNotice />
        </Modal>
        <Modal open={privacyOpen} close={() => setPrivacyOpen(false)} title={t("Privasi", "Privacy")} closeLabel={t("Tutup", "Close")}>
          <p className="text-sm leading-7 text-muted-foreground">
            {t(
              "Kami memakai nama, email atau nomor HP, dan riwayat booking hanya untuk mengelola jadwal bermainmu, mengirim konfirmasi, dan pengingat. Pada pratinjau ini, data tersimpan di perangkat ini saja—gunakan data uji, bukan data pribadi asli.",
              "We use your name, email or phone, and booking history only to manage your games and send confirmations and reminders. In this preview, data stays on this device—use test details rather than real personal data.",
            )}
          </p>
          <button type="button" className={`${button} mt-6 w-full`} onClick={() => setPrivacyOpen(false)}>{t("Mengerti", "Got it")}</button>
        </Modal>
      </MotionConfig>
    </AppContext.Provider>
  )
}

function NotFound() {
  const { club } = useApp()
  const { t } = useLocale()
  usePageTitle(t("Halaman tidak ditemukan", "Page not found"), club.name)
  return (
    <div className="px-6 py-24 text-center">
      <p className={`${eyebrow} text-sage`}>{t("Keluar lapangan · 404", "Out of court · 404")}</p>
      <h1 className="mt-4 font-display text-6xl">{t("Sepertinya keluar lapangan.", "Looks like that went out.")}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{t("Halaman ini tidak ditemukan.", "We couldn't find this page.")}</p>
      <Link className={`${button} mt-7`} to="/">{t("Kembali ke beranda", "Back home")} <ArrowRight size={16} /></Link>
    </div>
  )
}

function AdminRoute() {
  return (
    <Suspense fallback={<PageLoader label="Memuat ruang admin…" />}>
      <AdminApp />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { index: true, Component: ClubHome },
      { path: "book", Component: BookPage },
      { path: "checkout", element: <Navigate to="/bookings" replace /> },
      { path: "checkout/:id", Component: CheckoutPage },
      { path: "confirmation/:id", Component: ConfirmationPage },
      { path: "bookings", Component: MyBookingsPage },
      { path: "venue/:id", element: <Navigate to="/book" replace /> },
      { path: "admin/*", Component: AdminRoute },
      { path: "*", Component: NotFound },
    ],
  },
])

export default function App() {
  return (
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  )
}
