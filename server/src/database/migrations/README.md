# Database Migrations

This directory contains SQL migration files for the Echos database.

## How to Apply Migrations

You can apply migrations manually using `psql` or your preferred PostgreSQL client.

### Using psql

```bash
# Connect to your database
psql -h localhost -U your_user -d your_database

# Run a specific migration
\i server/src/database/migrations/add-unique-api-key-names.sql
```

### Using Docker

```bash
# If running in Docker
docker exec -i your_postgres_container psql -U your_user -d your_database < server/src/database/migrations/add-unique-api-key-names.sql
```
