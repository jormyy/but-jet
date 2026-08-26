# Database

Postgres, via Supabase. Seven tables, all owned by a user and all behind row
level security.

| table | holds |
| --- | --- |
| `categories` | user-defined categories, bucketed into bills / spending / savings |
| `merchant_categories` | remembers which category a merchant was filed under |
| `transactions` | income, expenses and savings transfers |
| `recurring_bills` | monthly / annual / weekly commitments |
| `net_worth_snapshots` | one row per user per day: assets and liabilities as JSONB, plus the total |
| `goals` | savings targets |
| `investment_holdings` | holdings, optionally ticker-backed with a share count |

## Row level security

Every table has one `FOR ALL` policy:

```sql
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)
```

Two details are load-bearing:

- **The subquery.** Written bare, `auth.uid()` is re-evaluated for every
  candidate row. Wrapped, the planner hoists it into an InitPlan run once per
  statement. This is Supabase's `auth_rls_initplan` advisory.
- **`WITH CHECK` spelled out.** Postgres defaults it to the `USING` expression,
  so this changes nothing about what is allowed — it just stops the write rule
  being implied by the read rule.

Only the `authenticated` role is granted table privileges. `anon` has none: RLS
would exclude it anyway (`auth.uid()` is null), and the app never reads data
before signing in.

## Indexes

RLS filters by `user_id`, it does not partition. On a shared table every read
costs every user's rows unless an index says otherwise. Column order follows how
the app reads — user first, then whatever it filters or orders by.

| index | serves |
| --- | --- |
| `transactions (user_id, date DESC)` | the month list and the six-month cash flow |
| `categories (user_id, bucket, name)` | the ordered category list and its joins |
| `recurring_bills (user_id, next_due_date)` | the bill list |
| `goals (user_id, created_at)` | the goal list |
| `investment_holdings (user_id, created_at)` | the holdings list |
| `transactions (category_id)` | `ON DELETE SET NULL` when a category goes |
| `recurring_bills (category_id)` | as above |
| `merchant_categories (category_id)` | as above |

`net_worth_snapshots` is covered by the `UNIQUE (user_id, date)` index from
migration 006, which serves both the history read and the latest-first lookup.

Measured against 202 accounts and 81k transactions:

| query | before | after |
| --- | --- | --- |
| current-month list | Seq Scan, 10.425 ms, 81,197 rows discarded | Index, 0.170 ms, 12 discarded |
| six-month cash flow | Seq Scan, 19.218 ms, 81,021 rows discarded | Index, 0.056 ms, 0 discarded |
| net worth history | 0.494 ms | 0.282 ms |

## Migrations

Numbered, applied in order, and expected to work on an empty database. Verify
that claim rather than assuming it:

```bash
supabase db reset
```

Migration 007 exists because the earlier ones did not. The hosted project
carries table grants because its tables were created by `supabase_admin`, whose
default privileges include them — but a project rebuilt from the migration
history alone could not read a single row.

Two rules:

- **Applying 008 to a live database needs `CREATE INDEX CONCURRENTLY`**, run
  outside a transaction. The file is written for a fresh database, where the
  brief lock does not matter.
- **Nothing here is applied automatically.** Deployment does not run migrations.

## Scheduled jobs

`create_daily_snapshots(target_date)` (migration 010) carries each user's most
recent snapshot forward, folds in the live portfolio total under `Investments`,
skips users with neither assets nor liabilities, and does nothing for a day that
already has a row. It is `SECURITY DEFINER` and only `service_role` may execute
it.

It replaced a loop that walked users one at a time at four round trips each,
which was the whole job's runtime past a handful of accounts.

`/api/cron/refresh-prices` fetches one quote per distinct symbol and writes only
the holdings whose price or date actually changed, sharing `src/lib/prices.ts`
with the investments tab.

## Query shapes to keep

- **Select what is drawn.** The net worth history plots date against total;
  selecting whole rows pulled both JSONB columns for every day ever recorded —
  249 KB against 31 KB for two years of daily snapshots, all of it also kept in
  the persisted cache.
- **Filter in the database.** `fetchCashflow` asks for a six-month range and
  totals it in the browser; it does not read the table and filter client-side.
- **One round trip per thing.** `adjustAccountBalance` is a read-modify-write on
  the day's snapshot. It is the one place that pays three round trips, and it is
  worth watching if transaction entry ever feels slow.
