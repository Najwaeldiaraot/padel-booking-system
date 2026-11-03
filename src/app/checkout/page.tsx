"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CheckoutIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/bookings");
  }, [router]);
  return null;
}
