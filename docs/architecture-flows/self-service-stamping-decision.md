# Self-Service Stamping Replay Guard

Date: 2026-06-30

Self-service stamping deliberately uses a stable venue QR slug for the customer
entry point. A photographed poster can be reopened away from the premises, so
the QR slug is not treated as proof of physical presence.

The accepted launch trade-off is lower customer friction at the counter, bounded
by these server-side controls:

- `issue_self_service_stamp` requires an active join QR context and a matching
  merchant, location, and loyalty card.
- The stamp ledger enforces one self-service stamp per customer, merchant,
  location, and UK business day.
- The server-side rate limit gates repeated stamp attempts.
- Soft geofence evidence can flag anomalous location data without blocking a
  legitimate customer whose browser location is unavailable or imprecise.
- Fraud flags are retained in `fraud_flags` and can now be resolved by an admin
  with an audited status change.
- Reward issuance and redemption remain server-authoritative; browser storage
  is never the loyalty ledger.

If the product later needs a stronger on-premises moat, the next design should
add a short-lived signed QR nonce layered over the stable poster URL. That would
make photographed codes expire while preserving the existing one-per-day ledger
guard as the replay backstop.
