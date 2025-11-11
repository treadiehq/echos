# Apply Database Migrations to Railway

Run these commands to apply the new migrations to your Railway database:

## Step 1: Organization Names Unique Constraint

```bash
psql "postgresql://postgres:nsBipnRXINDloQxljSchGHgaowHKUhgC@switchback.proxy.rlwy.net:11911/railway" -c "CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_unique_name ON organizations(LOWER(name));"
```

## Step 2: Verify

```bash
# Verify both indexes exist
psql "postgresql://postgres:nsBipnRXINDloQxljSchGHgaowHKUhgC@switchback.proxy.rlwy.net:11911/railway" -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('api_keys', 'organizations') AND indexname LIKE '%unique%';"
```

Expected output:
```
           indexname            
---------------------------------
 idx_api_keys_unique_name_per_org
 idx_organizations_unique_name
```

## What These Migrations Do

1. **API Key Names** - Ensures API key names are unique per organization (already applied ✅)
2. **Organization Names** - Ensures organization names are unique across all organizations (case-insensitive) + blocks reserved names

Delete this file after running migrations.

