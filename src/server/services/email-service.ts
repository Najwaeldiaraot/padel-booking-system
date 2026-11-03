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
    paymentMethod = "QRIS / Pembayaran Online",
    paymentTime = new Date().toLocaleString("id-ID"),
  } = params;

  // Ensure no "Midtrans" string leaks into the client-facing email
  const displayPaymentMethod = paymentMethod
    .replace(/\(?\s*midtrans\s*\)?/gi, "")
    .trim() || "QRIS / Pembayaran Online";

  const invoiceNumber = `INV/${date.replace(/-/g, "")}/${bookingCode.toUpperCase()}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    bookingCode
  )}&margin=8`;

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiket & Invoice Reservasi - ${bookingCode}</title>
</head>
<body style="margin: 0; padding: 32px 12px; background-color: #EDEAE1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1C2621; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #EDEAE1;">
    <tr>
      <td align="center">
        <!-- Main Ticket Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #F4F1EA; border: 2px solid #1C2621; border-collapse: separate; box-shadow: 0 10px 25px rgba(28,38,33,0.12);">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #1C2621; padding: 28px 32px; color: #FFFFFF;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #C9D3B0; display: block; margin-bottom: 4px;">
                      Official Match Pass
                    </span>
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #FFFFFF; font-family: Georgia, serif;">
                      Rally Padel Club<span style="color: #9B7058;">.</span>
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #E2E8E5;">
                      Jl. Kemang Raya No. 18, Jakarta Selatan
                    </p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #2D3E35; color: #FFFFFF; border: 1px solid #C9D3B0; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 5px 12px; letter-spacing: 0.1em; font-family: monospace;">
                      LUNAS / PAID
                    </span>
                    <span style="display: block; margin-top: 6px; font-size: 11px; font-family: monospace; color: #C9D3B0;">
                      ${invoiceNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top Stub: Greeting & Schedule Summary -->
          <tr>
            <td style="padding: 28px 32px 16px 32px;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #7A866C;">
                E-Tiket & Bukti Reservasi
              </p>
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #1C2621;">
                Hai, ${customerName}!
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                Pembayaran sewa lapangan Anda telah terverifikasi lunas. Tiket digital Anda telah aktif dan siap digunakan.
              </p>

              <!-- Match Box Highlight -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #E2E8E5; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #7A866C; display: block; margin-bottom: 4px;">
                      Lapangan
                    </span>
                    <span style="font-size: 18px; font-weight: 800; color: #1C2621; font-family: Georgia, serif;">
                      ${courtName}
                    </span>
                  </td>
                  <td align="right" style="padding: 16px 20px;">
                    <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #7A866C; display: block; margin-bottom: 4px;">
                      Waktu Main (WIB)
                    </span>
                    <span style="font-size: 15px; font-weight: 700; color: #1C2621;">
                      ${startTime} – ${endTime}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Detailed Info Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748B; border-bottom: 1px solid #E2E8E5;">Tanggal Bermain</td>
                  <td align="right" style="padding: 8px 0; font-weight: 600; color: #1C2621; border-bottom: 1px solid #E2E8E5;">${date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748B; border-bottom: 1px solid #E2E8E5;">Kode Booking</td>
                  <td align="right" style="padding: 8px 0; font-family: monospace; font-weight: 700; color: #1C2621; border-bottom: 1px solid #E2E8E5;">${bookingCode}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748B; border-bottom: 1px solid #E2E8E5;">Metode Pembayaran</td>
                  <td align="right" style="padding: 8px 0; font-weight: 600; color: #1C2621; border-bottom: 1px solid #E2E8E5;">${displayPaymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748B; border-bottom: 1px solid #E2E8E5;">Waktu Transaksi</td>
                  <td align="right" style="padding: 8px 0; font-weight: 500; color: #1C2621; border-bottom: 1px solid #E2E8E5;">${paymentTime}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 0 8px 0; font-size: 15px; font-weight: 800; color: #1C2621; border-top: 2px solid #1C2621;">Total Pembayaran</td>
                  <td align="right" style="padding: 14px 0 8px 0; font-size: 17px; font-weight: 800; color: #1C2621; border-top: 2px solid #1C2621; font-family: monospace;">Rp ${totalPrice.toLocaleString("id-ID")}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Perforated Line Divider -->
          <tr>
            <td style="padding: 0 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top: 2px dashed #C5BEB0; height: 1px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom Stub: Ticket Pass & High-Res QR Code -->
          <tr>
            <td style="padding: 24px 32px 32px 32px;" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 2px solid #1C2621; text-align: center;">
                <tr>
                  <td style="padding: 24px 20px;">
                    <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #7A866C; display: block; margin-bottom: 6px;">
                      Passcode Tiket Masuk
                    </span>
                    <span style="font-size: 22px; font-weight: 800; font-family: monospace; letter-spacing: 0.12em; color: #1C2621; display: block; margin-bottom: 14px;">
                      ${bookingCode.toUpperCase()}
                    </span>

                    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8E5; padding: 6px;">
                      <tr>
                        <td>
                          <img src="${qrCodeUrl}" alt="QR Tiket ${bookingCode}" width="160" height="160" style="display: block; border: 0;" />
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 14px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748B; max-width: 360px;">
                      Tunjukkan QR Code ini kepada concierge atau staf saat tiba di klub untuk check-in instan. Mohon hadir 15 menit sebelum waktu bermain.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #EDEAE1; border-top: 1px solid #DCDED2; padding: 18px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #7A866C; letter-spacing: 0.05em;">
                Rally Padel Club · Kemang, Jakarta Selatan · halo@rallypadel.club
              </p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #94A3B8;">
                Email konfirmasi otomatis. Harap simpan bukti ini untuk kelancaran akses bermain Anda.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
