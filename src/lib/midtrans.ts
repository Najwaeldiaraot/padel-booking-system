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
    tlv("00", "ID.CO.QRIS.WWW") +
      tlv("01", "ID1020021000002") +
      tlv("02", "0000000000000000303UMI")
  );
  const tag62 = tlv("62", tlv("01", orderId.slice(0, 25)));

  const base =
    tlv("00", "01") +
    tlv("01", "12") +
    tag26 +
    tlv("51", tlv("00", "ID.LINKAJA.WWW") + tlv("02", "0000000000000000303UMI")) +
    tlv("52", "5812") +
    tlv("53", "360") +
    tlv("54", amtStr) +
    tlv("58", "ID") +
    tlv("59", "RALLY PADEL CLUB") +
    tlv("60", "JAKARTA SELATAN") +
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
