import { prisma } from "../src/lib/prisma";
import { encryptPII, decryptPII, generateBlindIndex, encryptJSON } from "../src/lib/encryption";

function isEncrypted(val: string | null | undefined): boolean {
  if (!val) return false;
  const parts = val.split(":");
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

async function migrateAllSensitiveData() {
  console.log("=== MEMULAI ENKRIPSI TOTAL DATA SENSITIF & TRANSAKSI ===");

  // 1. MIGRASI BOOKINGS (customerName, nameBlindIndex, customerContact, cancelReason)
  console.log("\n[1/4] Memeriksa data Booking...");
  const bookings = await prisma.booking.findMany();
  let encryptedBookings = 0;

  for (const b of bookings) {
    const updateData: any = {};

    // Encrypt customerName
    if (!isEncrypted(b.customerName) && b.customerName) {
      updateData.nameBlindIndex = generateBlindIndex(b.customerName);
      updateData.customerName = encryptPII(b.customerName);
    } else if (!b.nameBlindIndex && b.customerName) {
      // Dekripsi dulu untuk dapat plain text lalu buat blind index
      const plain = decryptPII(b.customerName);
      updateData.nameBlindIndex = generateBlindIndex(plain);
    }

    // Encrypt customerContact
    if (!isEncrypted(b.customerContact) && b.customerContact && b.customerContact !== "-") {
      updateData.customerContact = encryptPII(b.customerContact);
    }

    // Encrypt cancelReason
    if (!isEncrypted(b.cancelReason) && b.cancelReason) {
      updateData.cancelReason = encryptPII(b.cancelReason);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.booking.update({
        where: { id: b.id },
        data: updateData,
      });
      encryptedBookings++;
    }
  }
  console.log(`✓ Berhasil memproses ${bookings.length} booking (${encryptedBookings} data dienkripsi).`);

  // 2. MIGRASI CUSTOMERS (name, nameBlindIndex, phone, email, notes)
  console.log("\n[2/4] Memeriksa data Pelanggan (Customer)...");
  const customers = await prisma.customer.findMany();
  let encryptedCustomers = 0;

  for (const c of customers) {
    const updateData: any = {};

    // Encrypt name
    if (!isEncrypted(c.name) && c.name) {
      updateData.nameBlindIndex = generateBlindIndex(c.name);
      updateData.name = encryptPII(c.name);
    } else if (!c.nameBlindIndex && c.name) {
      const plain = decryptPII(c.name);
      updateData.nameBlindIndex = generateBlindIndex(plain);
    }

    // Encrypt phone
    if (!isEncrypted(c.phone) && c.phone) {
      updateData.phoneBlindIndex = generateBlindIndex(c.phone);
      updateData.phone = encryptPII(c.phone);
    }

    // Encrypt email
    if (!isEncrypted(c.email) && c.email) {
      updateData.emailBlindIndex = generateBlindIndex(c.email);
      updateData.email = encryptPII(c.email);
    }

    // Encrypt notes
    if (!isEncrypted(c.notes) && c.notes) {
      updateData.notes = encryptPII(c.notes);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.customer.update({
        where: { id: c.id },
        data: updateData,
      });
      encryptedCustomers++;
    }
  }
  console.log(`✓ Berhasil memproses ${customers.length} customer (${encryptedCustomers} data dienkripsi).`);

  // 3. MIGRASI USERS (name, email, phone, blind indexes)
  console.log("\n[3/4] Memeriksa akun internal User...");
  const users = await prisma.user.findMany();
  let encryptedUsers = 0;

  for (const u of users) {
    const updateData: any = {};

    if (!isEncrypted(u.name) && u.name) {
      updateData.nameBlindIndex = generateBlindIndex(u.name);
      updateData.name = encryptPII(u.name);
    }

    if (!isEncrypted(u.email) && u.email) {
      updateData.emailBlindIndex = generateBlindIndex(u.email);
      // simpan blind index untuk lookup aman
    }

    if (!isEncrypted(u.phone) && u.phone) {
      updateData.phoneBlindIndex = generateBlindIndex(u.phone);
      updateData.phone = encryptPII(u.phone);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: u.id },
        data: updateData,
      });
      encryptedUsers++;
    }
  }
  console.log(`✓ Berhasil memproses ${users.length} user (${encryptedUsers} data dienkripsi).`);

  // 4. MIGRASI PAYMENTS (payload transaksi, transactionId)
  console.log("\n[4/4] Memeriksa data Transaksi (Payment)...");
  const payments = await prisma.payment.findMany();
  let encryptedPayments = 0;

  for (const p of payments) {
    const updateData: any = {};

    // Encrypt transaction payload
    if (p.payload && typeof p.payload === "object" && !("encrypted" in (p.payload as any))) {
      updateData.payload = { encrypted: encryptJSON(p.payload) };
    }

    // Encrypt transactionId
    if (p.transactionId && !isEncrypted(p.transactionId)) {
      updateData.transactionId = encryptPII(p.transactionId);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.payment.update({
        where: { id: p.id },
        data: updateData,
      });
      encryptedPayments++;
    }
  }
  console.log(`✓ Berhasil memproses ${payments.length} transaksi (${encryptedPayments} data dienkripsi).`);

  console.log("\n=== ENKRIPSI TOTAL BERHASIL DISELESAIKAN ===");
}

migrateAllSensitiveData()
  .catch((e) => {
    console.error("Gagal melakukan migrasi enkripsi total:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
