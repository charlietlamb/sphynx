import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    deliveryId: text("delivery_id").primaryKey(),
    eventType: text("event_type").notNull(),
    installationId: integer("installation_id"),
    receivedAt: timestamp("received_at").notNull(),
  },
  (table) => [index("webhook_delivery_received_idx").on(table.receivedAt)]
);
