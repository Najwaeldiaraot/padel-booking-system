import { PrismaClient, CourtType, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Padel Arena database...");

  // 1. Seed Users (Admin & Demo Player)
  const admin = await prisma.user.upsert({
    where: { email: "admin@padelarena.com" },
    update: {},
    create: {
      name: "Admin Arena",
      email: "admin@padelarena.com",
      phone: "+6281234567890",
      role: Role.OWNER,
    },
  });

  const player = await prisma.user.upsert({
    where: { email: "player@padelarena.com" },
    update: {},
    create: {
      name: "Demo Player",
      email: "player@padelarena.com",
      phone: "+6289876543210",
      role: Role.PLAYER,
    },
  });

  console.log("Seeded Users:", { admin: admin.email, player: player.email });

  // 2. Seed Courts
  const courtsData = [
    {
      id: 1,
      name: "Lapangan 1 — Panoramic Court",
      type: CourtType.PANORAMIC,
      pricePerHour: 250000,
      description: "Lapangan kaca panorama premium tanpa tiang sudut, rumput mondo grade turnamen internasional WPT.",
      photoUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
      isActive: true,
    },
    {
      id: 2,
      name: "Lapangan 2 — Indoor Central",
      type: CourtType.INDOOR,
      pricePerHour: 220000,
      description: "Lapangan indoor ber-AC dengan pencahayaan LED anti-glare, bebas cuaca hujan maupun terik matahari.",
      photoUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
      isActive: true,
    },
    {
      id: 3,
      name: "Lapangan 3 — Sunset Outdoor",
      type: CourtType.OUTDOOR,
      pricePerHour: 180000,
      description: "Lapangan outdoor terbuka dengan hembusan angin segar dan pemandangan sunset sore hari.",
      photoUrl: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
      isActive: true,
    },
  ];

  for (const court of courtsData) {
    await prisma.court.upsert({
      where: { id: court.id },
      update: {
        name: court.name,
        type: court.type,
        pricePerHour: court.pricePerHour,
        description: court.description,
        photoUrl: court.photoUrl,
        isActive: court.isActive,
      },
      create: court,
    });
  }

  console.log(`Seeded ${courtsData.length} courts successfully.`);
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
