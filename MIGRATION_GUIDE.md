# Database Migration Guide for Railway

## Applying the Unique API Key Names Migration

After pushing your code to Railway, you need to manually apply the database migration.

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
```bash
npm install -g @railway/cli
# or
brew install railway
```

2. **Login to Railway**:
```bash
railway login
```

3. **Link to your project**:
```bash
railway link
```

4. **Connect to your database and run the migration**:
```bash
# Get your DATABASE_URL
railway variables

# Connect to PostgreSQL and run the migration
railway run psql $DATABASE_URL -f server/src/database/migrations/add-unique-api-key-names.sql
```

Alternatively, open a psql session:
```bash
railway run psql $DATABASE_URL
```

Then paste this SQL:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_name_per_org 
  ON api_keys(org_id, name) 
  WHERE revoked_at IS NULL;
```

### Option 2: Using Railway Dashboard

1. Go to your Railway project dashboard
2. Click on your **PostgreSQL database service**
3. Go to the **"Connect"** tab
4. Copy the **"Postgres Connection URL"**
5. Use any PostgreSQL client (like TablePlus, pgAdmin, or psql locally):

```bash
psql "your-connection-url-here" -f server/src/database/migrations/add-unique-api-key-names.sql
```

Or connect and run the SQL directly:
```bash
psql "your-connection-url-here"
```

Then run:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_name_per_org 
  ON api_keys(org_id, name) 
  WHERE revoked_at IS NULL;
```

### Option 3: Using Railway's Query Feature

1. Go to your Railway project
2. Click on your **PostgreSQL service**
3. Go to **"Data"** tab
4. Click **"Query"**
5. Paste and run:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_name_per_org 
  ON api_keys(org_id, name) 
  WHERE revoked_at IS NULL;
```

### Verify the Migration

After running the migration, verify it was applied:

```sql
-- Check if the index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'api_keys' 
AND indexname = 'idx_api_keys_unique_name_per_org';
```

You should see the unique index listed.

### Testing

After applying the migration, try creating two API keys with the same name in your settings page - it should now prevent duplicates with a clear error message.

## Future Migrations

For future database changes, follow the same process:
1. Create a migration file in `server/src/database/migrations/`
2. Update the `schema.sql` file
3. Push your code to Railway
4. Manually run the migration using one of the methods above

