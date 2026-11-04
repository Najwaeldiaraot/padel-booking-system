import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  encryptPII,
  decryptPII,
  generateBlindIndex,
} from "@/lib/encryption";

export const dynamic = "force-dynamic";

function safeDecrypt(val: string | null): string | null {
  if (!val) return null;
  try {
    return decryptPII(val);
  } catch {
    return val;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || searchParams.get("q") || "";

    let whereClause: any = undefined;

    if (search.trim()) {
      const term = search.trim();
      const blindIndex = generateBlindIndex(term);

      whereClause = {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { nameBlindIndex: blindIndex },
          { phoneBlindIndex: blindIndex },
          { emailBlindIndex: blindIndex },
        ],
      };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        bookings: {
          select: {
            id: true,
            code: true,
            date: true,
            startTime: true,
            status: true,
            totalPrice: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedCustomers = customers.map((customer) => ({
      ...customer,
      name: safeDecrypt(customer.name) || customer.name,
      phone: safeDecrypt(customer.phone),
      email: safeDecrypt(customer.email),
    }));

    return NextResponse.json(decryptedCustomers);
  } catch (error: any) {
    console.error("[API Admin Customers GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, notes } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedPhone = typeof phone === "string" ? phone.trim() : null;
    const trimmedEmail = typeof email === "string" ? email.trim() : null;

    const encryptedName = encryptPII(trimmedName);
    const nameBlindIndex = generateBlindIndex(trimmedName);

    const encryptedPhone = trimmedPhone ? encryptPII(trimmedPhone) : null;
    const phoneBlindIndex = trimmedPhone ? generateBlindIndex(trimmedPhone) : null;

    const encryptedEmail = trimmedEmail ? encryptPII(trimmedEmail) : null;
    const emailBlindIndex = trimmedEmail ? generateBlindIndex(trimmedEmail) : null;

    // 1. Explicit ID update
    if (id) {
      const updateData: any = {
        name: encryptedName,
        nameBlindIndex,
        ...(notes !== undefined && { notes: notes ? encryptPII(notes) : null }),
      };

      if (phone !== undefined) {
        updateData.phone = encryptedPhone;
        updateData.phoneBlindIndex = phoneBlindIndex;
      }

      if (email !== undefined) {
        updateData.email = encryptedEmail;
        updateData.emailBlindIndex = emailBlindIndex;
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        ...updated,
        name: safeDecrypt(updated.name) || updated.name,
        phone: safeDecrypt(updated.phone),
        email: safeDecrypt(updated.email),
      });
    }

    // 2. Upsert check using blind indexes for unicity
    let existingCustomer = null;
    if (phoneBlindIndex || emailBlindIndex) {
      existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(phoneBlindIndex ? [{ phoneBlindIndex }] : []),
            ...(emailBlindIndex ? [{ emailBlindIndex }] : []),
          ],
        },
      });
    }

    if (existingCustomer) {
      const updateData: any = {
        name: encryptedName,
        nameBlindIndex,
        ...(notes !== undefined && { notes: notes ? encryptPII(notes) : null }),
      };

      if (encryptedPhone) {
        updateData.phone = encryptedPhone;
        updateData.phoneBlindIndex = phoneBlindIndex;
      }

      if (encryptedEmail) {
        updateData.email = encryptedEmail;
        updateData.emailBlindIndex = emailBlindIndex;
      }

      const updated = await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: updateData,
      });

      return NextResponse.json({
        ...updated,
        name: safeDecrypt(updated.name) || updated.name,
        phone: safeDecrypt(updated.phone),
        email: safeDecrypt(updated.email),
      });
    }

    // 3. Create new customer
    const created = await prisma.customer.create({
      data: {
        name: encryptedName,
        nameBlindIndex,
        phone: encryptedPhone,
        email: encryptedEmail,
        phoneBlindIndex,
        emailBlindIndex,
        notes: notes ? encryptPII(notes) : null,
      },
    });

    return NextResponse.json(
      {
        ...created,
        name: safeDecrypt(created.name) || created.name,
        phone: safeDecrypt(created.phone),
        email: safeDecrypt(created.email),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API Admin Customers POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create or update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Customer ID is required (?id=...)" },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error: any) {
    console.error("[API Admin Customers DELETE] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete customer" },
      { status: 500 }
    );
  }
}
