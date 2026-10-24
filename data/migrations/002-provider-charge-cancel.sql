-- Cancelled orders keep a payable Pix QR at Asaas until the charge is deleted there (lib/reservation-expiry.ts).
ALTER TABLE orders ADD COLUMN provider_cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN provider_cancel_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN provider_cancel_error TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_provider_cancel ON orders(status,provider_cancelled_at) WHERE provider_payment_id IS NOT NULL;
