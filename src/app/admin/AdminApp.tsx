import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { motion } from "motion/react"
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  ExternalLink,
  Grid2X2,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings2,
  Sparkles,
  Users,
  UsersRound,
  X,
} from "lucide-react"
import { api, previewAccounts, subscribe } from "../api"
import { cinematicEase } from "../CinematicMotion"
import { button, eyebrow, field, outlineButton, textLink, today, useApp, type Booking, type User } from "../club"
import { NotificationsMenu } from "../BookingParts"
import { errorMessage, notificationText } from "../i18n"
import { PageLoader, Spinner, usePageTitle } from "../ui"
import { AdminContext, Empty, id, useAdmin, useAdminData } from "./shared"
import AdminLiveBoard from "./AdminLiveBoard"
import {
  BookingDetailDialog,
  BookingsSection,
  CustomersSection,
  OperationDialog,
  Overview,
  ReviewsSection,
  ScheduleSection,
  TransactionsSection,
} from "./Operations"
import { ContentSection, CourtsSection, FacilitiesSection, SettingsSection, TeamSection } from "./ClubAdmin"

const navigation = [
  { id: "", label: "Ringkasan", icon: LayoutDashboard, group: "Operasional", owner: false, description: "Satu tempat untuk menjaga permainan, pemain, dan klub tetap berjalan." },
  { id: "live-board", label: "Live Board", icon: Activity, owner: false, description: "Papan antrean dan pemantauan pertandingan langsung hari ini secara real-time." },
  { id: "bookings", label: "Booking", icon: CalendarDays, owner: false, description: "Cari, filter, dan kelola seluruh booking klub." },
  { id: "schedule", label: "Jadwal lapangan", icon: Clock3, owner: false, description: "Atur ketersediaan lapangan, booking manual, dan waktu perawatan." },
  { id: "customers", label: "Pemain", icon: Users, owner: false, description: "Direktori pemain berdasarkan riwayat booking." },
  { id: "reviews", label: "Rating & ulasan", icon: MessageSquare, owner: false, description: "Balas dan moderasi penilaian dari booking selesai." },
  { id: "transactions", label: "Transaksi", icon: CreditCard, owner: true, description: "Status pembayaran, metode, dan pengembalian dana." },
  { id: "courts", label: "Lapangan", icon: Grid2X2, group: "Kelola klub", owner: true, description: "Nama, harga, foto, dan status setiap lapangan." },
  { id: "facilities", label: "Fasilitas", icon: Leaf, owner: true, description: "Fasilitas yang tampil di website dalam dua bahasa." },
  { id: "content", label: "Konten landing", icon: Sparkles, owner: true, description: "Headline, deskripsi, promosi, dan media halaman depan." },
  { id: "settings", label: "Pengaturan & kebijakan", icon: Settings2, owner: true, description: "Identitas klub, jam operasional, dan aturan booking." },
  { id: "team", label: "Tim & akses", icon: UsersRound, owner: true, description: "Kelola akun pemilik dan staf." },
]

function AdminLogin({ onLogin }: { onLogin: (user: User) => void }) {
  const { club } = useApp()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  usePageTitle("Masuk staf", club.name)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      onLogin(await api.auth.login({ identifier: email, password, scope: "staff" }))
    } catch (problem) {
      setError(errorMessage(problem, id))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <img src={club.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <Link to="/" className="font-display text-4xl">{club.name}<span className="text-sage-light">.</span></Link>
          <div>
            <p className={`${eyebrow} text-sage-light`}>Ruang staf</p>
            <h1 className="mt-4 font-display text-6xl leading-tight">Rally yang baik<br />dimulai di sini.</h1>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <p className={`${eyebrow} text-sage`}>{club.name}</p>
          <h1 className="font-display text-5xl">Masuk staf.</h1>
          <p className="text-sm leading-7 text-muted-foreground">Khusus pemilik dan staf klub. Lima kali gagal mengunci akses selama 15 menit.</p>
          <label className="block text-sm">Email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={`${field} mt-2`} /></label>
          <label className="block text-sm">Kata sandi<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${field} mt-2`} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button disabled={busy} className={`${button} w-full`}>{busy ? <Spinner className="text-primary-foreground" /> : <>Masuk <ArrowRight size={16} /></>}</button>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Akun pratinjau</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {previewAccounts.filter((item) => item.role !== "player").map((account) => (
                <button key={account.email} type="button" className={`${outlineButton} text-xs`} onClick={() => { setEmail(account.email); setPassword(account.password) }}>
                  {account.label}
                </button>
              ))}
            </div>
          </div>
          <Link to="/" className={`${textLink} text-muted-foreground`}>Kembali ke website <ExternalLink size={13} /></Link>
        </form>
      </div>
    </div>
  )
}

let cachedStaffUser: User | null = null

export default function AdminApp() {
  const { club, notify } = useApp()
  const [me, setMe] = useState<User | null>(cachedStaffUser)
  const [checked, setChecked] = useState(Boolean(cachedStaffUser))
  useEffect(() => {
    const check = () =>
      api.auth.me("staff").then((user) => {
        cachedStaffUser = user
        setMe((current) => (current?.id === user?.id && current?.role === user?.role ? current : user))
        setChecked(true)
      })
    check()
    return subscribe(check)
  }, [])
  const { data, loading, reload } = useAdminData(me)
  if (!checked) return <PageLoader label="Memeriksa akses…" />
  if (!me) return <AdminLogin onLogin={setMe} />
  return (
    <AdminContext.Provider value={{ ...data, me, isOwner: me.role === "owner", loading, reload, notify }}>
      <AdminShell club={club.name} me={me} onSignOut={async () => { await api.auth.logout("staff"); setMe(null) }} />
    </AdminContext.Provider>
  )
}

function AdminShell({ club, me, onSignOut }: { club: string; me: User; onSignOut: () => void }) {
  const location = useLocation()
  const section = location.pathname.split("/")[2] || ""
  const isOwner = me.role === "owner"
  const visible = navigation.filter((item) => isOwner || !item.owner)
  const active = navigation.find((item) => item.id === section)
  const [menu, setMenu] = useState(false)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [operation, setOperation] = useState<{ kind: "booking" | "block"; preset?: { court?: number; date?: string; time?: string } } | null>(null)
  usePageTitle(active ? `${active.label} · Admin` : "Admin", club)
  useEffect(() => setMenu(false), [location.pathname])
  const openOperation = (kind: "booking" | "block", preset?: { court?: number; date?: string; time?: string }) => setOperation({ kind, preset })
  const allowed = active && (isOwner || !active.owner)
  return (
    <AdminFrame
      club={club}
      me={me}
      menu={menu}
      setMenu={setMenu}
      visible={visible}
      section={section}
      onSignOut={onSignOut}
    >
      <div className="mx-auto max-w-[1600px] px-5 py-7 md:px-9 md:py-9">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className={`${eyebrow} mb-3 text-sage`}>{active?.group || (active ? navigation.slice(0, navigation.indexOf(active) + 1).reverse().find((item) => item.group)?.group : "Admin")}</p>
            <h1 className="font-display text-5xl leading-none">{section === "" ? "Rally yang baik dimulai di sini." : active?.label || "Halaman tidak ditemukan"}</h1>
            {active && <p className="mt-3 text-sm leading-6 text-muted-foreground">{active.description}</p>}
          </div>
          {allowed && ["", "live-board", "bookings", "schedule"].includes(section) && (
            <div className="flex flex-wrap gap-2">
              {section === "schedule" && <button type="button" className={outlineButton} onClick={() => openOperation("block")}><LockKeyhole size={14} /> Blokir slot</button>}
              <button type="button" className={button} onClick={() => openOperation("booking")}><Plus size={16} /> Booking walk-in / manual</button>
            </div>
          )}
        </div>
        {!active ? (
          <Empty title="Halaman admin tidak ditemukan." description="Pilih salah satu menu pengelolaan klub." action={<Link to="/admin" className={button}>Kembali ke ringkasan</Link>} />
        ) : !allowed ? (
          <Empty title="Akses khusus pemilik." description="Halaman ini hanya tersedia untuk akun pemilik klub." action={<Link to="/admin" className={button}>Kembali ke ringkasan</Link>} />
        ) : (
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: cinematicEase }}
          >
            {section === "" && <Overview openDetail={setDetail} openOperation={openOperation} />}
            {section === "live-board" && <AdminLiveBoard openDetail={setDetail} />}
            {section === "bookings" && <BookingsSection openDetail={setDetail} />}
            {section === "schedule" && <ScheduleSection openDetail={setDetail} openOperation={openOperation} />}
            {section === "customers" && <CustomersSection />}
            {section === "reviews" && <ReviewsSection />}
            {section === "transactions" && <TransactionsSection openDetail={setDetail} />}
            {section === "courts" && <CourtsSection />}
            {section === "facilities" && <FacilitiesSection />}
            {section === "content" && <ContentSection />}
            {section === "settings" && <SettingsSection />}
            {section === "team" && <TeamSection />}
          </motion.div>
        )}
        <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-5 text-2xs text-muted-foreground">
          <p>{club} · Manajemen klub</p>
          <p>Semua jadwal dalam WIB</p>
        </footer>
      </div>
      {detail && <BookingDetailDialog booking={detail} close={() => setDetail(null)} />}
      {operation && <OperationDialog kind={operation.kind} preset={operation.preset} close={() => setOperation(null)} />}
    </AdminFrame>
  )
}

function AdminFrame({
  club,
  me,
  menu,
  setMenu,
  visible,
  section,
  onSignOut,
  children,
}: {
  club: string
  me: User
  menu: boolean
  setMenu: (open: boolean) => void
  visible: typeof navigation
  section: string
  onSignOut: () => void
  children: ReactNode
}) {
  const { notifications, bookings } = useAdmin()
  const todayCount = bookings.filter((item) => item.date === today() && item.status === "confirmed").length
  const playingCount = bookings.filter((item) => item.status === "checked_in").length
  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenu(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [menu, setMenu])
  return (
    <div className="min-h-dvh bg-surface text-foreground lg:pl-64">
      {menu && <button type="button" className="fixed inset-0 z-30 bg-primary/40 backdrop-blur-sm lg:hidden" aria-label="Tutup navigasi admin" onClick={() => setMenu(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest-deep text-background transition-transform duration-500 ${menu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-start justify-between px-7 pt-8">
          <Link to="/admin" className="font-display text-3xl leading-tight">{club}<span className="text-sage-light">.</span></Link>
          <button type="button" aria-label="Tutup navigasi admin" onClick={() => setMenu(false)} className="flex size-11 items-center justify-center lg:hidden"><X size={20} /></button>
        </div>
        <p className={`${eyebrow} mx-7 mt-4 flex items-center gap-2 border-b border-white/15 pb-6 font-normal text-white/60`}><span className="size-1.5 bg-sage-light" aria-hidden="true" />Manajemen klub</p>
        <nav aria-label="Navigasi admin" className="flex-1 overflow-y-auto px-4 py-5">
          {visible.map((item) => (
            <div key={item.id}>
              {item.group && <p className={`${eyebrow} px-3 pt-4 pb-2 font-medium text-white/50`}>{item.group}</p>}
              <Link
                to={`/admin${item.id ? `/${item.id}` : ""}`}
                aria-current={section === item.id ? "page" : undefined}
                className="group relative my-0.5 flex min-h-11 items-center px-3 text-sm"
              >
                {section === item.id && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-accent shadow-xs"
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  />
                )}
                <span className={`relative z-10 flex w-full items-center gap-3 transition-colors ${section === item.id ? "font-semibold text-primary" : "text-white/75 group-hover:text-white"}`}>
                  <item.icon size={17} strokeWidth={1.5} aria-hidden="true" />
                  {item.label}
                  {item.id === "live-board" && playingCount > 0 && (
                    <span className={`ml-auto flex items-center gap-1 px-2 py-0.5 text-2xs font-bold rounded-full ${section === item.id ? "bg-emerald-600/20 text-emerald-800" : "bg-emerald-500/25 text-emerald-300"}`} aria-label={`${playingCount} sesi aktif`}>
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {playingCount}
                    </span>
                  )}
                  {item.id === "bookings" && todayCount > 0 && (
                    <span className={`ml-auto px-2 py-0.5 text-2xs rounded-full ${section === item.id ? "bg-primary/10 text-primary font-bold" : "bg-white/15 text-white"}`} aria-label={`${todayCount} booking hari ini`}>
                      {todayCount}
                    </span>
                  )}
                </span>
              </Link>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/15 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center border border-white/20 font-display text-xl" aria-hidden="true">{me.name[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{me.name}</p>
              <p className="text-2xs text-white/60">{me.role === "owner" ? "Pemilik" : "Staf"}</p>
            </div>
            <button type="button" aria-label="Keluar" onClick={onSignOut} className="flex size-11 items-center justify-center hover:bg-white/10"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-3 border-b border-border bg-surface/90 px-5 backdrop-blur-md md:px-9">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className="flex size-11 items-center justify-center lg:hidden" aria-label="Buka navigasi admin" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={22} /></button>
          <span className="truncate text-xs text-muted-foreground">Ruang admin <span className="mx-2 text-border">/</span><span className="text-primary">{navigation.find((item) => item.id === section)?.label || "Halaman"}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsMenu
            items={notifications}
            describe={(item) => notificationText(item, id)}
            onOpen={() => api.admin.markNotificationsRead()}
            onItemClick={(item) => api.admin.markNotificationRead(item.id)}
            label="Notifikasi klub"
            emptyText="Belum ada notifikasi."
          />
          <Link to="/" className={`${outlineButton} !min-h-11 text-xs max-sm:!hidden`}>Lihat website <ExternalLink size={13} /></Link>
        </div>
      </header>
      {children}
    </div>
  )
}

