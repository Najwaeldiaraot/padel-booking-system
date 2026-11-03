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
      name: "Court 01 · Panoramic",
      type: CourtType.OUTDOOR,
      pricePerHour: 250000,
      description: "Pandangan luas, udara terbuka. Untuk setiap rally terbaikmu.",
      photoUrl: "https://images.unsplash.com/photo-1709587824751-dd30420f5cf3?auto=format&fit=crop&w=1200&q=85",
      isActive: true,
    },
    {
      id: 2,
      name: "Court 02 · Garden",
      type: CourtType.OUTDOOR,
      pricePerHour: 275000,
      description: "Dikelilingi ruang hijau, dekat dengan lounge dan kafe klub.",
      photoUrl: "https://images.unsplash.com/photo-1709587824637-2126d83d3216?auto=format&fit=crop&w=1200&q=85",
      isActive: true,
    },
    {
      id: 3,
      name: "Court 03 · Covered",
      type: CourtType.INDOOR,
      pricePerHour: 300000,
      description: "Bermain nyaman, siang atau malam, tanpa khawatir cuaca.",
      photoUrl: "https://images.unsplash.com/photo-1673266893352-6de89e258064?auto=format&fit=crop&w=1200&q=85",
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
