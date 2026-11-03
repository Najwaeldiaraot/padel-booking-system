import { subscribeToSlotEvents, type SlotSSEEvent } from "@/server/services/slot-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat event
      controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));

      // Subscribe to real-time events from Redis / SlotService
      const unsubscribe = subscribeToSlotEvents((event: SlotSSEEvent) => {
        try {
          const payload = `event: slot_update\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          console.error("[SSE] Failed to push to stream:", e);
        }
      });

      // Keepalive heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
