# Deployment

## Vercel

The app deploys as a normal Next.js project on Vercel. Set these environment variables for
Production, Preview, and Development:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

Do not add a service-role key. Redeploy after changing either value.

## Automatic database migrations

Vercel builds the Next.js app; it does not run SQL migrations. Migrations run in GitHub Actions
through [`.github/workflows/supabase-migrations.yml`](../.github/workflows/supabase-migrations.yml).

The workflow runs when a file under `supabase/migrations/` is pushed to `main`, and can also be
started manually from the repository's **Actions** tab. It uses a concurrency lock so two migration
runs cannot overlap.

### Required GitHub repository secrets

Add these under **GitHub → repository → Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase Dashboard → Account → Access Tokens |
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Project Settings → Database |
| `SUPABASE_PROJECT_ID` | The project ref from the Supabase project URL |

The project ref is the part before `.supabase.co`, for example `abcdefghijklmnopqrst` in
`https://abcdefghijklmnopqrst.supabase.co`.

### First migration

1. Add the three secrets.
2. Push the workflow and the migration files to `main`, or open **Actions → Apply Supabase
   migrations → Run workflow**.
3. Confirm the workflow finishes successfully.
4. Verify the tables in the Supabase SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected: `expenses`, `partners`, `profiles`, `sales_memo_items`, `sales_memos`.

### Important rules

- Do not run `supabase db reset` against the hosted project.
- Do not run `supabase/seed.sql` against the hosted project; it creates local demo accounts.
- Do not add a migration step to the Vercel build command. Preview builds and repeated builds should
  not mutate the production database.
- If migrations were previously applied manually through the SQL Editor, the remote migration
  history table is empty. Mark those versions as applied with `supabase migration repair --status
  applied <version>` before relying on `supabase db push`; otherwise the workflow will try to apply
  them again.
