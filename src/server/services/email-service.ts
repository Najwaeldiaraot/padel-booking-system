import { prisma } from "@/lib/prisma";

export interface SendInvoiceEmailParams {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  paymentMethod?: string;
  paymentTime?: string;
}

export async function sendBookingInvoiceEmail(params: SendInvoiceEmailParams) {
  const {
    bookingId,
    bookingCode,
    customerName,
    customerEmail,
    courtName,
    date,
    startTime,
    endTime,
    totalPrice,
    paymentMethod = "QRIS (Midtrans)",
    paymentTime = new Date().toLocaleString("id-ID"),
  } = params;

  const invoiceNumber = `INV/${date.replace(/-/g, "")}/${bookingCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(bookingCode)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice Pembayaran - ${bookingCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6f5; color: #1c2621; padding: 24px; margin: 0; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8e5; overflow: hidden; }
    .header { background: #1c2621; color: #ffffff; padding: 28px 32px; }
    .badge { display: inline-block; background: #22c55e; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; }
    .body { padding: 32px; }
    .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid #f0f3f1; font-size: 14px; }
    .info-table td.label { color: #64748b; width: 40%; }
    .info-table td.value { font-weight: 600; text-align: right; }
    .total-row { font-size: 18px; font-weight: 800; color: #1c2621; border-top: 2px solid #1c2621; }
    .qr-section { background: #f9fbf9; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin-top: 24px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Rally Padel Club.</h1>
        <span class="badge">LUNAS / PAID</span>
      </div>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1;">Jl. Kemang Raya No. 18, Jakarta Selatan</p>
    </div>
    <div class="body">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">E-Receipt & Bukti Pemesanan</p>
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Hai, ${customerName}!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
        Pembayaran sewa lapangan Anda telah kami terima dan diverifikasi. Berikut rincian reservasi Anda:
      </p>

      <table class="info-table">
        <tr><td class="label">No. Invoice</td><td class="value">${invoiceNumber}</td></tr>
        <tr><td class="label">Kode Booking</td><td class="value" style="font-family: monospace; font-size: 15px;">${bookingCode}</td></tr>
        <tr><td class="label">Lapangan</td><td class="value">${courtName}</td></tr>
        <tr><td class="label">Jadwal Bermain</td><td class="value">${date} (${startTime} - ${endTime} WIB)</td></tr>
        <tr><td class="label">Metode Pembayaran</td><td class="value">${paymentMethod}</td></tr>
        <tr><td class="label">Waktu Pembayaran</td><td class="value">${paymentTime}</td></tr>
        <tr class="total-row">
          <td style="padding-top: 14px;">Total Dibayar</td>
          <td style="padding-top: 14px; text-align: right; color: #166534;">Rp ${totalPrice.toLocaleString("id-ID")}</td>
        </tr>
      </table>

      <div class="qr-section">
        <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1c2621;">
          Tunjukkan QR Code Ini Saat Tiba di Klub
        </p>
        <img src="${qrCodeUrl}" alt="QR Tiket ${bookingCode}" width="150" height="150" style="display: block; margin: 0 auto; border-radius: 4px;" />
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
          Staf akan memindai kode ini untuk check-in instan. Mohon tiba 15 menit sebelum jadwal.
        </p>
      </div>
    </div>
    <div class="footer">
      Rally Padel Club · Kemang, Jakarta Selatan · halo@rallypadel.club
    </div>
  </div>
</body>
</html>
`;

  // 1. Try sending via Resend API if API key exists
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Rally Padel Club <onboarding@resend.dev>";

  // In Resend Sandbox mode, emails can only be delivered to the verified account owner (muhammadrafki718@gmail.com).
  // If customerEmail is demo / unverified domain, deliver to the verified owner address so testing succeeds.
  const targetEmail =
    customerEmail &&
    customerEmail.includes("@") &&
    !customerEmail.endsWith("@rallypadel.club") &&
    !customerEmail.endsWith("@contoh.id") &&
    !customerEmail.endsWith("@padel.test")
      ? customerEmail
      : "muhammadrafki718@gmail.com";

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: targetEmail,
          subject: `Invoice & Tiket Booking ${bookingCode} - Rally Padel Club`,
          html: htmlContent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Email] Invoice email sent to ${targetEmail} via Resend. ID: ${data?.id}`);
      } else {
        console.warn(`[Email] Resend API error (${res.status}):`, data);
      }
    } catch (e) {
      console.warn("[Email] Failed to send email via Resend API:", e);
    }
  } else {
    console.log(`[Email Simulator] Invoice generated for ${customerName} (${targetEmail}): ${invoiceNumber}`);
  }

  // 2. Also record in user notification table in Supabase
  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking?.userId) {
      await prisma.notification.create({
        data: {
          userId: booking.userId,
          title: `Invoice & Tiket: ${courtName}`,
          message: `Pembayaran ${invoiceNumber} sebesar Rp ${totalPrice.toLocaleString("id-ID")} berhasil. Tunjukkan QR tiket saat tiba.`,
        },
      });
    }
  } catch (err) {
    console.warn("[Email] Could not create in-app notification:", err);
  }

  return { invoiceNumber, htmlContent, qrCodeUrl };
}
