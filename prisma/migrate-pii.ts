import { prisma } from "../src/lib/prisma";
import { encryptPII, generateBlindIndex } from "../src/lib/encryption";

async function migrateExistingPlainTextData() {
  console.log("Starting PII encryption & Customer database backfill migration...");

  // 1. Migrate Bookings & populate Customer records
  const bookings = await prisma.booking.findMany({
    include: { customer: true },
  });

  console.log(`Found ${bookings.length} bookings to inspect.`);

  let encryptedBookings = 0;
  let createdCustomers = 0;

  for (const b of bookings) {
    let rawContact = b.customerContact || "";
    const isContactEncrypted = rawContact.includes(":") && rawContact.split(":").length === 3;
    const cleanContact = isContactEncrypted ? rawContact : rawContact.trim();

    // Plain text phone or email
    const isEmail = cleanContact.includes("@");
    const isPhone = !isEmail && cleanContact.length > 5;

    // Check if customer already exists for this contact
    let customer = b.customer;
    if (!customer && cleanContact) {
      const blindIndex = generateBlindIndex(cleanContact);
      if (isEmail) {
        customer = await prisma.customer.findFirst({
          where: { emailBlindIndex: blindIndex },
        });
      } else if (isPhone) {
        customer = await prisma.customer.findFirst({
          where: { phoneBlindIndex: blindIndex },
        });
      }

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: b.customerName || "Pemain Klub",
            email: isEmail ? encryptPII(cleanContact) : null,
            emailBlindIndex: isEmail ? generateBlindIndex(cleanContact) : null,
            phone: isPhone ? encryptPII(cleanContact) : null,
            phoneBlindIndex: isPhone ? generateBlindIndex(cleanContact) : null,
            totalSpent: b.totalPrice || 0,
            totalBookings: 1,
          },
        });
        createdCustomers++;
      } else {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            totalSpent: { increment: b.totalPrice || 0 },
            totalBookings: { increment: 1 },
          },
        });
      }
    }

    // Encrypt booking contact if still plain text
    const updateData: any = {};
    if (!isContactEncrypted && rawContact) {
      updateData.customerContact = encryptPII(rawContact);
      encryptedBookings++;
    }
    if (customer && b.customerId !== customer.id) {
      updateData.customerId = customer.id;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.booking.update({
        where: { id: b.id },
        data: updateData,
      });
    }
  }

  console.log(`Migration complete!`);
  console.log(`- Created ${createdCustomers} Customer records.`);
  console.log(`- Encrypted ${encryptedBookings} plain text booking contacts.`);
}

migrateExistingPlainTextData()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
