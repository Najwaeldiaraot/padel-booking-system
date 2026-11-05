export interface BusySlot {
  court: number;
  date: string;
  time: string;
  duration: number;
  kind: "booking" | "hold" | "block";
  bookingId?: string;
}

export const defaultClub = {
  id: "the-court",
  name: "Rally Padel Club",
  area: "Kemang, Jakarta Selatan",
  address: "Jl. Kemang Raya No. 18, Jakarta Selatan",
  whatsappNumber: "",
  email: "halo@rallypadel.club",
  tagline: "Rumah untuk rally berikutnya.",
  description:
    "Satu klub. Banyak cara menikmati permainan. Lapangan panoramic, sudut kopi, dan ruang untuk bertemu teman—semuanya di rumah padel kami di Kemang.",
  photo: "https://images.unsplash.com/photo-1709587824637-2126d83d3216?auto=format&fit=crop&w=1200&q=85",
  heroPhoto: "https://images.unsplash.com/photo-1689942963385-f5bd03f3b270?auto=format&fit=crop&w=2000&q=85",
  heroVideo: "",
  openHour: 7,
  closeHour: 22,
  marketing: {
    headline: "Ada permainan.",
    accent: "Ada tempat untuk pulang.",
    description:
      "Tinggalkan rutinitas di luar lapangan. Temukan permainan yang seru, teman yang baru, dan alasan untuk kembali lagi.",
    promoTitle: "",
    promoText: "",
    promoEnabled: false,
  },
  policy: {
    cancellationHours: 24,
    refundPercent: 100,
    allowReschedule: true,
    rescheduleHours: 2,
    maxReschedules: 1,
    holdMinutes: 10,
    arrivalMinutes: 15,
  },
  courtOptions: [
    {
      id: 1,
      name: "Court 01 · Panoramic",
      type: "Outdoor",
      price: 250000,
      photo: "https://images.unsplash.com/photo-1709587824751-dd30420f5cf3?auto=format&fit=crop&w=1200&q=85",
      description: "Pandangan luas, udara terbuka. Untuk setiap rally terbaikmu.",
      active: true,
      en: { description: "Wide views, open air. Made for your best rallies." },
    },
    {
      id: 2,
      name: "Court 02 · Garden",
      type: "Outdoor",
      price: 275000,
      photo: "https://images.unsplash.com/photo-1709587824637-2126d83d3216?auto=format&fit=crop&w=1200&q=85",
      description: "Dikelilingi ruang hijau, dekat dengan lounge dan kafe klub.",
      active: true,
      en: {
        description: "Wrapped in greenery, a few steps from the lounge and club café.",
      },
    },
    {
      id: 3,
      name: "Court 03 · Covered",
      type: "Indoor",
      price: 300000,
      photo: "https://images.unsplash.com/photo-1673266893352-6de89e258064?auto=format&fit=crop&w=1200&q=85",
      description: "Bermain nyaman, siang atau malam, tanpa khawatir cuaca.",
      active: true,
      en: { description: "Play in comfort, day or night, whatever the weather." },
    },
  ],
  facilityOptions: [
    {
      id: "cafe",
      name: "Kafe & lounge",
      description: "Kopi yang baik. Obrolan setelah permainan yang lebih baik.",
      active: true,
      en: {
        name: "Café & lounge",
        description: "Good coffee. Even better conversations after the game.",
      },
    },
    {
      id: "rackets",
      name: "Sewa raket",
      description: "Baru pertama main? Perlengkapan tersedia di klub.",
      active: true,
      en: {
        name: "Racket rental",
        description: "First time playing? Equipment is ready at the club.",
      },
    },
    {
      id: "changing",
      name: "Ruang ganti & shower",
      description: "Segarkan diri, lalu lanjutkan harimu.",
      active: true,
      en: {
        name: "Changing rooms & showers",
        description: "Freshen up, then carry on with your day.",
      },
    },
    {
      id: "parking",
      name: "Area parkir",
      description: "Datang bersama teman, parkir dengan nyaman.",
      active: true,
      en: {
        name: "Parking",
        description: "Arrive with friends and park with ease.",
      },
    },
  ],
  en: {
    area: "Kemang, South Jakarta",
    tagline: "Home for your next rally.",
    description:
      "One club. Many ways to enjoy the game. Panoramic courts, a coffee corner, and room to meet friends—all at our padel home in Kemang.",
    marketing: {
      headline: "There's a game.",
      accent: "There's a place to come home to.",
      description:
        "Leave the routine outside the court. Find great games, new friends, and a reason to come back.",
    },
  },
};
