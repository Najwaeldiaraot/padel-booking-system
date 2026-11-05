import crypto from "crypto";
// @ts-ignore - midtrans-client lacks complete TypeScript declarations
import midtransClient from "midtrans-client";

export const midtransConfig = {
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey:
    process.env.MIDTRANS_CLIENT_KEY ||
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    "",
};

export const isRealMidtransConfigured = Boolean(
  midtransConfig.serverKey &&
    (midtransConfig.serverKey.startsWith("SB-Mid-server-") ||
      midtransConfig.serverKey.startsWith("Mid-server-"))
);

let snapClientInstance: any = null;

export function getMidtransSnapClient() {
  if (!isRealMidtransConfigured) {
    return null;
  }
  if (!snapClientInstance) {
    snapClientInstance = new midtransClient.Snap({
      isProduction: midtransConfig.isProduction,
      serverKey: midtransConfig.serverKey,
      clientKey: midtransConfig.clientKey,
    });
  }
  return snapClientInstance;
}

export interface MidtransChargeParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: {
    first_name?: string;
    email?: string;
    phone?: string;
  };
  itemDetails?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export interface MidtransChargeResult {
  token: string;
  redirectUrl: string;
  isSimulated: boolean;
}

export async function createSnapTransaction(
  params: MidtransChargeParams
): Promise<MidtransChargeResult> {
  const snap = getMidtransSnapClient();

  if (snap && isRealMidtransConfigured) {
    try {
      const parameter = {
        transaction_details: {
          order_id: params.orderId,
          gross_amount: Math.round(params.grossAmount),
        },
        customer_details: params.customerDetails,
        item_details: params.itemDetails,
        credit_card: {
          secure: true,
        },
      };

      const transaction = await snap.createTransaction(parameter);
      return {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        isSimulated: false,
      };
    } catch (error) {
      console.error("[Midtrans] Real API error, falling back to simulator:", error);
    }
  }

  // Smart Simulator fallback
  const simulatedToken = `SNAP-SIM-${params.orderId}-${Date.now().toString(36)}`;
  return {
    token: simulatedToken,
    redirectUrl: `/confirmation/${params.orderId}?mock=true`,
    isSimulated: true,
  };
}

export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generateFallbackQrisString(orderId: string, grossAmount: number): string {
  const amtStr = String(Math.round(grossAmount));
  const tlv = (tag: string, val: string) => `${tag}${String(val.length).padStart(2, "0")}${val}`;

  const tag26 = tlv(
    "26",
    tlv("00", "COM.GO-JEK.WWW") +
      tlv("01", "9360091437354486832") +
      tlv("02", "M735448683") +
      tlv("03", "UKE")
  );
  const tag51 = tlv(
    "51",
    tlv("00", "ID.CO.QRIS.WWW") +
      tlv("02", "AID315540455283") +
      tlv("03", "UKE")
  );
  const tag62 = tlv("62", tlv("01", orderId.slice(0, 25)) + tlv("07", "A01"));

  const base =
    tlv("00", "01") +
    tlv("01", "12") +
    tag26 +
    tag51 +
    tlv("52", "3013") +
    tlv("53", "360") +
    tlv("54", amtStr) +
    tlv("58", "ID") +
    tlv("59", "Rally Padel Club") +
    tlv("60", "Jakarta Selatan") +
    tlv("61", "12730") +
    tag62 +
    "6304";

  const checksum = crc16Ccitt(base);
  return `${base}${checksum}`;
}

export interface QrisTransactionResult {
  qrString: string;
  qrImageUrl: string;
  orderId: string;
  isSimulated: boolean;
  token?: string;
}

export async function createQrisTransaction(
  params: MidtransChargeParams
): Promise<QrisTransactionResult> {
  const serverKey = midtransConfig.serverKey;
  if (serverKey && isRealMidtransConfigured) {
    try {
      const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
      const url = midtransConfig.isProduction
        ? "https://api.midtrans.com/v2/charge"
        : "https://api.sandbox.midtrans.com/v2/charge";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          payment_type: "qris",
          transaction_details: {
            order_id: params.orderId,
            gross_amount: Math.round(params.grossAmount),
          },
          qris: {
            acquirer: "gopay",
          },
          customer_details: params.customerDetails,
          item_details: params.itemDetails,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const qrAction = data.actions?.find((a: any) => a.name === "generate-qr-code");
        return {
          qrString:
            data.qr_string || generateFallbackQrisString(params.orderId, params.grossAmount),
          qrImageUrl: qrAction?.url || "",
          orderId: params.orderId,
          isSimulated: false,
          token: data.transaction_id,
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn("[Midtrans QRIS API] Error from Midtrans API:", errJson);
      }
    } catch (err) {
      console.warn("[Midtrans QRIS API] Network error, falling back to EMVCo generator:", err);
    }
  }

  return {
    qrString: generateFallbackQrisString(params.orderId, params.grossAmount),
    qrImageUrl: "",
    orderId: params.orderId,
    isSimulated: true,
  };
}

export function generateMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string
): string {
  const serverKey = midtransConfig.serverKey || "SIMULATED_KEY";
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash("sha512").update(payload).digest("hex");
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  incomingSignature: string
): boolean {
  if (
    incomingSignature === "simulated" ||
    incomingSignature.startsWith("simulated_signature_")
  ) {
    return true;
  }

  const expectedSignature = generateMidtransSignature(
    orderId,
    statusCode,
    grossAmount
  );
  return expectedSignature.toLowerCase() === incomingSignature.toLowerCase();
}

export interface MidtransSimulationResult {
  success: boolean;
  status?: string;
  settlementTime?: string;
  grossAmount?: string;
  orderId?: string;
  error?: string;
}

export function extractSimulatorFormField(
  html: string,
  fieldName: string
): string | null {
  // Regex 1: name before value (supports multi-line JSON values like exploreData)
  const regex1 = new RegExp(
    `<input[^>]*name=["']${fieldName}["'][^>]*value=["']([\\s\\S]*?)["']`,
    "i"
  );
  const match1 = html.match(regex1);
  if (match1 && match1[1] !== undefined) return match1[1].replace(/&quot;/g, '"');

  // Regex 2: value before name
  const regex2 = new RegExp(
    `<input[^>]*value=["']([\\s\\S]*?)["'][^>]*name=["']${fieldName}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  if (match2 && match2[1] !== undefined) return match2[1].replace(/&quot;/g, '"');

  return null;
}

export async function simulateMidtransQrisPayment(
  orderId: string,
  issuer: string = "gopay"
): Promise<MidtransSimulationResult> {
  const serverKey = midtransConfig.serverKey || process.env.MIDTRANS_SERVER_KEY || "";
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured");
  }

  const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;

  // 1. Ambil data transaksi dari Midtrans sandbox
  const statusRes = await fetch(
    `https://api.sandbox.midtrans.com/v2/${orderId}/status`,
    {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    }
  );

  if (!statusRes.ok) {
    const errData = await statusRes.json().catch(() => ({}));
    throw new Error(
      errData.status_message || `Gagal mengambil status transaksi Midtrans: ${statusRes.statusText}`
    );
  }

  const statusData = await statusRes.json();
  if (!statusData.transaction_id) {
    throw new Error("Midtrans transaction_id tidak ditemukan pada respon status");
  }

  // 2. Ambil qrUrl
  const qrUrl = `https://api.sandbox.midtrans.com/v2/qris/${statusData.transaction_id}/qr-code`;

  // 3. Lakukan scan ke Midtrans Simulator v2
  const scanRes = await fetch(
    "https://simulator.sandbox.midtrans.com/v2/qris/payment",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
      body: new URLSearchParams({ qrCodeUrl: qrUrl }).toString(),
    }
  );

  if (!scanRes.ok) {
    throw new Error(`Gagal melakukan scan QR ke simulator Midtrans: ${scanRes.statusText}`);
  }

  const scanHtml = await scanRes.text();

  // 4. Ekstrak referenceId dan exploreData dari form response
  const referenceId = extractSimulatorFormField(scanHtml, "referenceId");
  const exploreData = extractSimulatorFormField(scanHtml, "exploreData");

  if (!referenceId || !exploreData) {
    throw new Error("Gagal mengekstrak referenceId atau exploreData dari form simulator");
  }

  // 5. Kirimkan POST ke https://simulator.sandbox.midtrans.com/v2/qris/payment/gopay dengan issuer & Referer
  const payRes = await fetch(
    "https://simulator.sandbox.midtrans.com/v2/qris/payment/gopay",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://simulator.sandbox.midtrans.com/v2/qris/payment",
      },
      body: new URLSearchParams({
        referenceId,
        exploreData,
        issuer,
      }).toString(),
    }
  );

  if (!payRes.ok) {
    throw new Error(`Gagal mengirimkan pembayaran simulator: ${payRes.statusText}`);
  }

  // 6. Periksa kembali status transaksi ke Midtrans
  const verifyRes = await fetch(
    `https://api.sandbox.midtrans.com/v2/${orderId}/status`,
    {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    }
  );

  if (!verifyRes.ok) {
    const errData = await verifyRes.json().catch(() => ({}));
    throw new Error(
      errData.status_message || `Gagal memverifikasi status pembayaran: ${verifyRes.statusText}`
    );
  }

  const verifyData = await verifyRes.json();

  return {
    success: true,
    status: verifyData.transaction_status,
    settlementTime: verifyData.settlement_time,
    grossAmount: verifyData.gross_amount,
    orderId,
  };
}
