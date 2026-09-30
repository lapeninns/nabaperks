/**
 * The venue trading day, as the stamp rules see it.
 *
 * The one-stamp-per-day guard and the daily referral cap compare against
 * `public.venue_trading_date(merchant_id, now())`, which rolls over at the
 * location's `trading_day_starts_at` (default 05:00 Europe/London), not at UK
 * midnight. Fixtures that age rows relative to the UK calendar date collide
 * with "today" between midnight and the trading-day start, so derive fixture
 * dates from these helpers instead.
 */

/** The merchant's current trading date and the instant that trading day began. */
export async function currentTradingDay(tx, merchantId) {
  const [row] = await tx`
    select trading.trading_date,
           (trading.trading_date::timestamp + coalesce((
              select locations.trading_day_starts_at
              from public.merchant_locations locations
              where locations.merchant_id = ${merchantId}::uuid
              order by locations.is_primary desc, locations.created_at asc, locations.id asc
              limit 1
            ), time '05:00')) at time zone 'Europe/London' as starts_at
    from (
      select public.venue_trading_date(${merchantId}::uuid, now()) as trading_date
    ) trading`
  return { tradingDate: row.trading_date, startsAt: row.starts_at }
}
