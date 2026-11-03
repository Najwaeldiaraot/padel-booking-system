import { useState, type ReactNode } from "react"
import { ArrowUpRight, Check, Leaf, Plus, Settings2, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { api } from "../api"
import {
  button,
  clock,
  dangerButton,
  eyebrow,
  field,
  money,
  normalizeWhatsAppNumber,
  outlineButton,
  photos,
  textLink,
  useApp,
  type ClubConfig,
  type Court,
  type Facility,
  type Venue,
} from "../club"
import { errorMessage, policyLines } from "../i18n"
import { Spinner } from "../ui"
import { AdminDialog, Empty, Panel, id, useAdmin } from "./shared"

const configOf = ({ courts: _courts, price: _price, type: _type, ...config }: Venue): ClubConfig => structuredClone(config)

function useSave(close?: () => void) {
  const { notify } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const save = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError("")
    try {
      await task()
      notify(success)
      close?.()
    } catch (problem) {
      setError(errorMessage(problem, id))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, save, setError }
}

function Pair({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset className="border border-border p-4">
      <legend className="px-2 text-xs font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      {hint && <p className="mt-2 text-2xs leading-5 text-muted-foreground">{hint}</p>}
    </fieldset>
  )
}

const Text = ({ label, value, onChange, multiline, required, max, lang }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; required?: boolean; max?: number; lang?: string }) => (
  <label className="block text-xs">
    {label}
    {multiline ? (
      <textarea lang={lang} required={required} maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} className={`${field} mt-2 min-h-24 py-3`} />
    ) : (
      <input lang={lang} required={required} maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} className={`${field} mt-2`} />
    )}
  </label>
)

function SaveBar({ busy, error, close, label = "Simpan perubahan" }: { busy: boolean; error: string; close: () => void; label?: string }) {
  return (
    <>
      {error && <p role="alert" className="mt-4 text-xs text-destructive">{error}</p>}
      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <button type="button" className={outlineButton} onClick={close}>Batal</button>
        <button disabled={busy} className={`${button} flex-1`}>{busy ? <Spinner className="text-primary-foreground" /> : <>{label} <Check size={16} /></>}</button>
      </div>
    </>
  )
}

const validUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/* ---------- Courts ---------- */

function CourtEditor({ court, close }: { court?: Court; close: () => void }) {
  const { club } = useApp()
  const nextId = Math.max(0, ...club.courtOptions.map((item) => item.id)) + 1
  const [draft, setDraft] = useState<Court>(
    court ? structuredClone(court) : { id: nextId, name: `Court ${String(nextId).padStart(2, "0")} · `, type: "Outdoor", price: 250000, photo: photos.court, description: "", active: true, en: {} },
  )
  const { busy, error, save, setError } = useSave(close)
  const set = (patch: Partial<Court>) => setDraft({ ...draft, ...patch })
  return (
    <AdminDialog title={court ? `Edit ${court.name}` : "Tambah lapangan"} close={close} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.name.trim() || !Number.isFinite(draft.price) || draft.price < 10000) return setError("Isi nama dan harga minimal Rp10.000 per jam.")
          if (!validUrl(draft.photo)) return setError("Gunakan URL foto HTTPS yang valid.")
          const config = configOf(club)
          config.courtOptions = court ? config.courtOptions.map((item) => (item.id === court.id ? draft : item)) : [...config.courtOptions, draft]
          save(() => api.admin.updateClub(config, `${draft.name} ${court ? "diperbarui" : "ditambahkan"}.`), "Lapangan tersimpan.")
        }}
      >
        <Pair label="Nama lapangan" hint="Format “Court 01 · Panoramic” menampilkan nama pendek di website.">
          <Text label="Bahasa Indonesia" required max={70} value={draft.name} onChange={(name) => set({ name })} />
          <Text label="English (opsional)" lang="en" max={70} value={draft.en?.name || ""} onChange={(name) => set({ en: { ...draft.en, name } })} />
        </Pair>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">Tipe<select value={draft.type} onChange={(event) => set({ type: event.target.value as Court["type"] })} className={`${field} mt-2`}><option>Outdoor</option><option>Indoor</option></select></label>
          <label className="block text-xs">Harga per jam (Rp)<input type="number" min={10000} step={1000} value={draft.price} onChange={(event) => set({ price: Number(event.target.value) })} className={`${field} mt-2`} /></label>
        </div>
        <Pair label="Deskripsi">
          <Text label="Bahasa Indonesia" multiline max={200} value={draft.description} onChange={(description) => set({ description })} />
          <Text label="English (opsional)" lang="en" multiline max={200} value={draft.en?.description || ""} onChange={(description) => set({ en: { ...draft.en, description } })} />
        </Pair>
        <label className="block text-xs">URL foto lapangan<input type="url" value={draft.photo} onChange={(event) => set({ photo: event.target.value })} className={`${field} mt-2`} /></label>
        <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={draft.active} onChange={(event) => set({ active: event.target.checked })} className="accent-primary" />Aktif & dapat dibooking</label>
        <p className="text-2xs leading-5 text-muted-foreground">Perubahan harga tidak memengaruhi booking yang sudah dikonfirmasi. Lapangan nonaktif disembunyikan dari pemain, tetapi riwayat booking tetap tersimpan.</p>
        <SaveBar busy={busy} error={error} close={close} />
      </form>
    </AdminDialog>
  )
}

export function CourtsSection() {
  const { club } = useApp()
  const [editing, setEditing] = useState<Court | "new" | null>(null)
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {club.courtOptions.map((court) => (
          <article key={court.id} className="overflow-hidden border border-border bg-card">
            <div className="relative h-48 overflow-hidden">
              <img src={court.photo} alt="" className="h-full w-full object-cover" />
              <span className={`absolute top-4 left-4 px-3 py-1.5 text-2xs ${court.active ? "bg-background text-primary" : "bg-primary text-primary-foreground"}`}>{court.active ? "Aktif · dapat dibooking" : "Nonaktif"}</span>
            </div>
            <div className="p-5">
              <h2 className="font-display text-2xl">{court.name}</h2>
              <p className="mt-2 text-2xs tracking-eyebrow text-muted-foreground uppercase">{court.type}</p>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">{court.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm font-medium">{money(court.price)}<span className="text-2xs text-muted-foreground"> / jam</span></p>
                <button type="button" className={outlineButton} onClick={() => setEditing(court)}><Settings2 size={15} /> Edit</button>
              </div>
            </div>
          </article>
        ))}
        <button type="button" onClick={() => setEditing("new")} className="flex min-h-64 flex-col items-center justify-center border border-dashed border-sage bg-secondary/40 p-8 transition hover:bg-secondary">
          <Plus size={22} aria-hidden="true" />
          <span className="mt-4 font-display text-2xl">Tambah lapangan</span>
        </button>
      </div>
      {editing && <CourtEditor court={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
    </>
  )
}

/* ---------- Facilities ---------- */

function FacilityEditor({ facility, close }: { facility?: Facility; close: () => void }) {
  const { club } = useApp()
  const [draft, setDraft] = useState<Facility>(facility ? structuredClone(facility) : { id: `facility-${Date.now()}`, name: "", description: "", active: true, en: {} })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { busy, error, save, setError } = useSave(close)
  const set = (patch: Partial<Facility>) => setDraft({ ...draft, ...patch })
  const persist = (list: Facility[], summary: string, success: string) => {
    const config = configOf(club)
    config.facilityOptions = list
    save(() => api.admin.updateClub(config, summary), success)
  }
  return (
    <AdminDialog title={facility ? `Edit ${facility.name}` : "Tambah fasilitas"} close={close} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.name.trim()) return setError("Isi nama fasilitas.")
          persist(facility ? club.facilityOptions.map((item) => (item.id === facility.id ? draft : item)) : [...club.facilityOptions, draft], `Fasilitas ${draft.name} disimpan.`, "Fasilitas tersimpan.")
        }}
      >
        <Pair label="Nama fasilitas">
          <Text label="Bahasa Indonesia" required max={70} value={draft.name} onChange={(name) => set({ name })} />
          <Text label="English (opsional)" lang="en" max={70} value={draft.en?.name || ""} onChange={(name) => set({ en: { ...draft.en, name } })} />
        </Pair>
        <Pair label="Deskripsi">
          <Text label="Bahasa Indonesia" multiline max={250} value={draft.description} onChange={(description) => set({ description })} />
          <Text label="English (opsional)" lang="en" multiline max={250} value={draft.en?.description || ""} onChange={(description) => set({ en: { ...draft.en, description } })} />
        </Pair>
        <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={draft.active} onChange={(event) => set({ active: event.target.checked })} className="accent-primary" />Tampilkan di website</label>
        {facility &&
          (confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 bg-danger-soft p-4 text-xs">
              <span className="flex-1">Hapus {facility.name} dari website?</span>
              <button type="button" className={outlineButton} onClick={() => setConfirmDelete(false)}>Batal</button>
              <button type="button" disabled={busy} className={dangerButton} onClick={() => persist(club.facilityOptions.filter((item) => item.id !== facility.id), `Fasilitas ${facility.name} dihapus.`, "Fasilitas dihapus.")}>Hapus</button>
            </div>
          ) : (
            <button type="button" className={`${textLink} text-destructive`} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Hapus fasilitas</button>
          ))}
        <SaveBar busy={busy} error={error} close={close} />
      </form>
    </AdminDialog>
  )
}

export function FacilitiesSection() {
  const { club } = useApp()
  const [editing, setEditing] = useState<Facility | "new" | null>(null)
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {club.facilityOptions.map((facility) => (
          <div key={facility.id} className="border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <span className="bg-secondary p-3" aria-hidden="true"><Leaf size={21} strokeWidth={1.3} /></span>
              <span className={`px-2.5 py-1 text-2xs ${facility.active ? "bg-secondary" : "bg-muted text-muted-foreground"}`}>{facility.active ? "Ditampilkan" : "Disembunyikan"}</span>
            </div>
            <h2 className="mt-5 font-display text-3xl">{facility.name}</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">{facility.description}</p>
            <button type="button" onClick={() => setEditing(facility)} className={`${textLink} mt-3`}>Edit fasilitas <ArrowUpRight size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setEditing("new")} className="flex min-h-44 items-center justify-center gap-3 border border-dashed border-sage bg-secondary/40 text-sm transition hover:bg-secondary">
          <Plus size={18} aria-hidden="true" /> Tambah fasilitas
        </button>
      </div>
      {editing && <FacilityEditor facility={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
    </>
  )
}

/* ---------- Landing content ---------- */

function ContentEditor({ close }: { close: () => void }) {
  const { club } = useApp()
  const [draft, setDraft] = useState<ClubConfig>(configOf(club))
  const { busy, error, save, setError } = useSave(close)
  const marketing = (key: keyof ClubConfig["marketing"], value: string | boolean) => setDraft({ ...draft, marketing: { ...draft.marketing, [key]: value } })
  const marketingEn = (key: "headline" | "accent" | "description" | "promoTitle" | "promoText", value: string) =>
    setDraft({ ...draft, en: { ...draft.en, marketing: { ...draft.en?.marketing, [key]: value } } })
  return (
    <AdminDialog title="Edit konten landing" close={close} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.marketing.headline.trim() || !draft.marketing.accent.trim()) return setError("Headline utama dan aksen wajib diisi.")
          if (draft.marketing.promoEnabled && (!draft.marketing.promoTitle.trim() || !draft.marketing.promoText.trim())) return setError("Isi judul dan isi promosi, atau nonaktifkan promosi.")
          if ([draft.heroPhoto, draft.photo].some((url) => !validUrl(url)) || (draft.heroVideo && !validUrl(draft.heroVideo))) return setError("Gunakan URL foto atau video HTTPS yang valid.")
          save(() => api.admin.updateClub(draft, "Konten landing diperbarui."), "Konten landing tersimpan.")
        }}
      >
        <p className="text-xs leading-6 text-muted-foreground">Isian English tampil saat pengunjung memilih EN. Jika kosong, website memakai teks Bahasa Indonesia.</p>
        <Pair label="Headline utama">
          <Text label="Bahasa Indonesia" required max={36} value={draft.marketing.headline} onChange={(value) => marketing("headline", value)} />
          <Text label="English" lang="en" max={36} value={draft.en?.marketing?.headline || ""} onChange={(value) => marketingEn("headline", value)} />
        </Pair>
        <Pair label="Headline aksen (miring)">
          <Text label="Bahasa Indonesia" required max={40} value={draft.marketing.accent} onChange={(value) => marketing("accent", value)} />
          <Text label="English" lang="en" max={40} value={draft.en?.marketing?.accent || ""} onChange={(value) => marketingEn("accent", value)} />
        </Pair>
        <Pair label="Deskripsi hero">
          <Text label="Bahasa Indonesia" multiline max={220} value={draft.marketing.description} onChange={(value) => marketing("description", value)} />
          <Text label="English" lang="en" multiline max={220} value={draft.en?.marketing?.description || ""} onChange={(value) => marketingEn("description", value)} />
        </Pair>
        <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={draft.marketing.promoEnabled} onChange={(event) => marketing("promoEnabled", event.target.checked)} className="accent-primary" />Tampilkan banner promosi</label>
        {draft.marketing.promoEnabled && (
          <>
            <Pair label="Judul promosi">
              <Text label="Bahasa Indonesia" max={70} value={draft.marketing.promoTitle} onChange={(value) => marketing("promoTitle", value)} />
              <Text label="English" lang="en" max={70} value={draft.en?.marketing?.promoTitle || ""} onChange={(value) => marketingEn("promoTitle", value)} />
            </Pair>
            <Pair label="Isi promosi" hint="Gunakan untuk penawaran nyata, misalnya paket pemula atau harga pagi.">
              <Text label="Bahasa Indonesia" multiline max={300} value={draft.marketing.promoText} onChange={(value) => marketing("promoText", value)} />
              <Text label="English" lang="en" multiline max={300} value={draft.en?.marketing?.promoText || ""} onChange={(value) => marketingEn("promoText", value)} />
            </Pair>
          </>
        )}
        <label className="block text-xs">URL foto hero<input type="url" value={draft.heroPhoto} onChange={(event) => setDraft({ ...draft, heroPhoto: event.target.value })} className={`${field} mt-2`} /></label>
        <label className="block text-xs">URL foto klub & fasilitas<input type="url" value={draft.photo} onChange={(event) => setDraft({ ...draft, photo: event.target.value })} className={`${field} mt-2`} /></label>
        <label className="block text-xs">
          URL video hero (opsional)
          <input value={draft.heroVideo || ""} onChange={(event) => setDraft({ ...draft, heroVideo: event.target.value })} placeholder="https://…/video.mp4" className={`${field} mt-2`} />
          <span className="mt-2 block text-2xs leading-5 text-muted-foreground">Diputar tanpa suara; foto hero menjadi cadangan saat video tidak tersedia atau pengguna memilih reduced motion.</span>
        </label>
        <SaveBar busy={busy} error={error} close={close} />
      </form>
    </AdminDialog>
  )
}

export function ContentSection() {
  const { club } = useApp()
  const [editing, setEditing] = useState(false)
  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Pratinjau hero" action={<a href="/" target="_blank" rel="noopener noreferrer" className={textLink}>Buka website <ArrowUpRight size={13} /></a>}>
        <div className="relative isolate min-h-96 overflow-hidden bg-primary p-7 text-primary-foreground md:p-10">
          <img src={club.heroPhoto} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-primary/65" />
          <p className={eyebrow}>{club.name}</p>
          <h2 className="mt-12 font-display text-5xl leading-[1.05]">{club.marketing.headline}<br /><em className="text-sage-light">{club.marketing.accent}</em></h2>
          <p className="mt-5 max-w-md text-xs leading-6 text-white/80">{club.marketing.description}</p>
          <p className="mt-6 text-2xs text-white/70">EN: {club.en?.marketing?.headline || "—"} {club.en?.marketing?.accent || ""}</p>
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel>
          <div className="p-6">
            <p className={`${eyebrow} text-muted-foreground`}>Banner promosi</p>
            <p className="mt-3 text-sm font-medium">{club.marketing.promoEnabled ? "Aktif di website" : "Tidak ditampilkan"}</p>
            {club.marketing.promoEnabled && <p className="mt-2 font-display text-2xl">{club.marketing.promoTitle}</p>}
            <p className="mt-3 text-xs leading-6 text-muted-foreground">Tampilkan hanya untuk penawaran nyata agar landing tidak mengulang ajakan booking.</p>
          </div>
        </Panel>
        <button type="button" className={`${button} w-full`} onClick={() => setEditing(true)}><Settings2 size={16} /> Edit konten landing</button>
      </div>
      {editing && <ContentEditor close={() => setEditing(false)} />}
    </div>
  )
}

/* ---------- Settings & policy ---------- */

function IdentityEditor({ close }: { close: () => void }) {
  const { club } = useApp()
  const [draft, setDraft] = useState<ClubConfig>(configOf(club))
  const { busy, error, save, setError } = useSave(close)
  const set = (patch: Partial<ClubConfig>) => setDraft({ ...draft, ...patch })
  const setEn = (key: "area" | "tagline" | "description", value: string) => setDraft({ ...draft, en: { ...draft.en, [key]: value } })
  return (
    <AdminDialog title="Edit identitas klub" close={close} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const whatsapp = draft.whatsappNumber.trim()
          if (whatsapp && (!/^\+?[\d\s()-]+$/.test(whatsapp) || !/^[1-9]\d{7,14}$/.test(normalizeWhatsAppNumber(whatsapp)))) return setError("Isi nomor WhatsApp dengan kode negara, mis. +62, atau kosongkan.")
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) return setError("Isi email klub yang valid.")
          save(() => api.admin.updateClub({ ...draft, name: draft.name.trim(), address: draft.address.trim(), email: draft.email.trim(), whatsappNumber: whatsapp ? normalizeWhatsAppNumber(whatsapp) : "" }, "Identitas klub diperbarui."), "Identitas klub tersimpan.")
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Nama klub" required max={70} value={draft.name} onChange={(name) => set({ name })} />
          <Text label="Alamat" required max={160} value={draft.address} onChange={(address) => set({ address })} />
          <label className="block text-xs">Email klub<input type="email" required value={draft.email} onChange={(event) => set({ email: event.target.value })} className={`${field} mt-2`} /></label>
          <label className="block text-xs">WhatsApp klub (opsional)<input type="tel" inputMode="tel" placeholder="+62…" value={draft.whatsappNumber} onChange={(event) => set({ whatsappNumber: event.target.value })} className={`${field} mt-2`} /></label>
        </div>
        <Pair label="Area">
          <Text label="Bahasa Indonesia" max={60} value={draft.area} onChange={(area) => set({ area })} />
          <Text label="English" lang="en" max={60} value={draft.en?.area || ""} onChange={(value) => setEn("area", value)} />
        </Pair>
        <Pair label="Tagline">
          <Text label="Bahasa Indonesia" max={120} value={draft.tagline} onChange={(tagline) => set({ tagline })} />
          <Text label="English" lang="en" max={120} value={draft.en?.tagline || ""} onChange={(value) => setEn("tagline", value)} />
        </Pair>
        <Pair label="Tentang klub">
          <Text label="Bahasa Indonesia" multiline max={600} value={draft.description} onChange={(description) => set({ description })} />
          <Text label="English" lang="en" multiline max={600} value={draft.en?.description || ""} onChange={(value) => setEn("description", value)} />
        </Pair>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">Jam buka (WIB)<select value={draft.openHour} onChange={(event) => set({ openHour: Number(event.target.value) })} className={`${field} mt-2`}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{clock(hour)}</option>)}</select></label>
          <label className="block text-xs">Jam tutup (WIB)<select value={draft.closeHour} onChange={(event) => set({ closeHour: Number(event.target.value) })} className={`${field} mt-2`}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour + 1}>{clock(hour + 1)}</option>)}</select></label>
        </div>
        <SaveBar busy={busy} error={error} close={close} />
      </form>
    </AdminDialog>
  )
}

function PolicyEditor({ close }: { close: () => void }) {
  const { club } = useApp()
  const [policy, setPolicy] = useState(structuredClone(club.policy))
  const { busy, error, save, setError } = useSave(close)
  const number = (key: keyof typeof policy, label: string, min: number, max: number, suffix: string) => (
    <label className="block text-xs">
      {label}
      <span className="mt-2 flex items-center border border-border bg-card focus-within:border-primary">
        <input type="number" min={min} max={max} value={Number(policy[key])} onChange={(event) => setPolicy({ ...policy, [key]: Number(event.target.value) })} className="min-h-12 w-full bg-transparent px-4 text-sm outline-none" />
        <span className="px-4 text-muted-foreground">{suffix}</span>
      </span>
    </label>
  )
  return (
    <AdminDialog title="Kebijakan booking" close={close} wide>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (policy.refundPercent < 0 || policy.refundPercent > 100 || policy.holdMinutes < 5 || policy.holdMinutes > 30) return setError("Refund 0–100% dan durasi hold 5–30 menit.")
          save(() => api.admin.updateClub({ ...configOf(club), policy }, "Kebijakan booking diperbarui."), "Kebijakan booking tersimpan.")
        }}
      >
        <fieldset className="grid gap-3 border border-border p-4 sm:grid-cols-2">
          <legend className="px-2 text-xs font-medium">Pembatalan & refund</legend>
          {number("cancellationHours", "Batas pembatalan", 0, 168, "jam sebelum")}
          {number("refundPercent", "Dana dikembalikan", 0, 100, "%")}
        </fieldset>
        <fieldset className="space-y-3 border border-border p-4">
          <legend className="px-2 text-xs font-medium">Ubah jadwal mandiri oleh pemain</legend>
          <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={policy.allowReschedule} onChange={(event) => setPolicy({ ...policy, allowReschedule: event.target.checked })} className="accent-primary" />Izinkan pemain memindahkan jadwal sendiri tanpa persetujuan</label>
          {policy.allowReschedule && (
            <div className="grid gap-3 sm:grid-cols-2">
              {number("rescheduleHours", "Batas ubah jadwal", 0, 168, "jam sebelum")}
              {number("maxReschedules", "Maksimal per booking", 1, 5, "kali")}
            </div>
          )}
        </fieldset>
        <fieldset className="grid gap-3 border border-border p-4 sm:grid-cols-2">
          <legend className="px-2 text-xs font-medium">Checkout & kedatangan</legend>
          {number("holdMinutes", "Slot ditahan saat checkout", 5, 30, "menit")}
          {number("arrivalMinutes", "Datang sebelum jadwal", 0, 60, "menit")}
        </fieldset>
        <div className="bg-secondary/60 p-4">
          <p className={`${eyebrow} text-muted-foreground`}>Pratinjau untuk pemain</p>
          <ul className="mt-3 space-y-2 text-xs leading-6">{policyLines(policy, id).slice(0, 2).map((item) => <li key={item.title}><strong>{item.title}:</strong> {item.text}</li>)}</ul>
        </div>
        <SaveBar busy={busy} error={error} close={close} />
      </form>
    </AdminDialog>
  )
}

export function SettingsSection() {
  const { club } = useApp()
  const { audit } = useAdmin()
  const [editing, setEditing] = useState<"identity" | "policy" | null>(null)
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <Panel title="Identitas klub" action={<button type="button" className={outlineButton} onClick={() => setEditing("identity")}><Settings2 size={15} /> Edit</button>}>
          <dl className="grid gap-5 border-t border-border p-5 text-xs sm:grid-cols-2">
            {[
              ["Nama", club.name],
              ["Alamat", club.address],
              ["Jam operasional", `${clock(club.openHour)}–${clock(club.closeHour)} WIB setiap hari`],
              ["Kontak", `${club.email}${club.whatsappNumber ? ` · +${club.whatsappNumber}` : " · WhatsApp belum diatur"}`],
              ["Tagline", club.tagline],
              ["Tentang klub", club.description],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 leading-6">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Kebijakan booking" description="Berlaku langsung untuk booking baru dan perubahan jadwal." action={<button type="button" className={outlineButton} onClick={() => setEditing("policy")}><Settings2 size={15} /> Edit</button>}>
          <dl className="grid gap-5 border-t border-border p-5 text-xs sm:grid-cols-2">
            {policyLines(club.policy, id).map((item) => (
              <div key={item.title}>
                <dt className="text-muted-foreground">{item.title}</dt>
                <dd className="mt-1 leading-6">{item.text}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel>
          <div className="p-6">
            <ShieldCheck size={23} strokeWidth={1.3} aria-hidden="true" />
            <h2 className="mt-4 font-display text-3xl">Siap disambungkan.</h2>
            <p className="mt-4 text-xs leading-7 text-muted-foreground">Seluruh data saat ini tersimpan di perangkat ini melalui adapter lokal. Login staf, pembayaran, dan notifikasi akan berjalan sungguhan setelah backend terhubung.</p>
          </div>
        </Panel>
        <Panel title="Riwayat pengelolaan">
          <div className="max-h-96 space-y-4 overflow-y-auto border-t border-border p-5">
            {audit.map((entry) => (
              <div key={entry.id} className="border-l border-primary/20 pl-3">
                <p className="text-xs leading-5">{entry.message}</p>
                <p className="mt-1 text-2xs text-muted-foreground">{entry.actor} · {new Date(entry.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
              </div>
            ))}
            {!audit.length && <p className="text-xs text-muted-foreground">Aktivitas admin akan tercatat di sini.</p>}
          </div>
        </Panel>
      </div>
      {editing === "identity" && <IdentityEditor close={() => setEditing(null)} />}
      {editing === "policy" && <PolicyEditor close={() => setEditing(null)} />}
    </div>
  )
}

/* ---------- Team ---------- */

function AddMember({ close }: { close: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"staff" | "owner">("staff")
  const [password, setPassword] = useState("")
  const { busy, error, save } = useSave(close)
  return (
    <AdminDialog title="Tambah anggota tim" close={close}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save(() => api.admin.addStaff({ name, email, role, password }), "Anggota tim ditambahkan.") }}>
        <Text label="Nama" required max={60} value={name} onChange={setName} />
        <label className="block text-xs">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={`${field} mt-2`} /></label>
        <label className="block text-xs">
          Peran
          <select value={role} onChange={(event) => setRole(event.target.value as "staff" | "owner")} className={`${field} mt-2`}>
            <option value="staff">Staf · booking, jadwal, pemain, ulasan</option>
            <option value="owner">Pemilik · akses penuh termasuk transaksi & pengaturan</option>
          </select>
        </label>
        <label className="block text-xs">Kata sandi sementara<input type="text" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={`${field} mt-2 font-mono`} /></label>
        <p className="text-2xs leading-5 text-muted-foreground">Bagikan kata sandi sementara secara langsung. Setelah backend terhubung, undangan dikirim lewat email.</p>
        <SaveBar busy={busy} error={error} close={close} label="Tambah anggota" />
      </form>
    </AdminDialog>
  )
}

export function TeamSection() {
  const { staff, me } = useAdmin()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const { busy, error, save } = useSave(() => setRemoving(null))
  return (
    <Panel title="Tim & akses" description="Pemilik mengelola semua hal. Staf menangani operasional harian tanpa akses transaksi dan pengaturan klub." action={<button type="button" className={button} onClick={() => setAdding(true)}><UserPlus size={16} /> Tambah anggota</button>}>
      {staff.length ? (
        <ul className="divide-y divide-border border-t border-border">
          {staff.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center bg-secondary font-display text-xl" aria-hidden="true">{member.name[0]}</span>
                <div>
                  <p className="text-sm font-medium">{member.name} {member.id === me.id && <span className="text-2xs text-muted-foreground">(kamu)</span>}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 text-2xs ${member.role === "owner" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{member.role === "owner" ? "Pemilik" : "Staf"}</span>
                {member.id !== me.id &&
                  (removing === member.id ? (
                    <>
                      <button type="button" className={outlineButton} onClick={() => setRemoving(null)}>Batal</button>
                      <button type="button" disabled={busy} className={dangerButton} onClick={() => save(() => api.admin.removeStaff(member.id), `Akses ${member.name} dicabut.`)}>Cabut akses</button>
                    </>
                  ) : (
                    <button type="button" aria-label={`Cabut akses ${member.name}`} className="flex size-11 items-center justify-center text-muted-foreground hover:bg-secondary" onClick={() => setRemoving(member.id)}>
                      <Trash2 size={16} />
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="Belum ada anggota tim." description="Tambahkan staf untuk berbagi pekerjaan operasional." />
      )}
      {error && <p role="alert" className="px-5 pb-4 text-xs text-destructive">{error}</p>}
      {adding && <AddMember close={() => setAdding(false)} />}
    </Panel>
  )
}
