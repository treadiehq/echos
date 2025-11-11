# Production Setup Guide

## Environment Variables

For production deployment, you need to set these environment variables:

### Required

```bash
# API Key for server-side operations (replay, etc.)
ECHOS_SYSTEM_API_KEY=your-api-key-here

# Or use the standard API key
ECHOS_API_KEY=your-api-key-here

# Database connection
DATABASE_URL=postgresql://user:password@host:5432/echos

# Session secret for authentication
SESSION_SECRET=your-long-random-secret-here
```

### Optional

```bash
# API URL (defaults to localhost:4000 in dev)
ECHOS_API_URL=https://api.yourdomain.com

# Node environment
NODE_ENV=production

# Port configuration
PORT=4000
```

## Time-Travel Debugging in Production

The Time-Travel Debug feature requires an API key to replay workflows. You have two options:

### Option 1: System API Key (Recommended)
Create a dedicated API key with limited permissions for server-side operations:

1. Log in to your Echos dashboard
2. Go to Settings → API Keys
3. Create a new key named "System Replay Key"
4. Set `ECHOS_SYSTEM_API_KEY=<your-key>` in production

### Option 2: Use Existing API Key
Set `ECHOS_API_KEY` to an existing key (the same one used by the SDK)

## Security Considerations

1. **API Keys**: Never commit API keys to git. Use environment variables or secret management.
2. **SSE Tokens**: Tokens expire after 5 minutes and are tied to specific users/orgs.
3. **Replay Permissions**: Only authenticated users in the same org can replay traces.

## Architecture

### Time-Travel Debug Flow (Production)

```
User clicks "Test Fix"
  ↓
Frontend requests stream token (authenticated)
  ↓
Backend generates secure token (expires in 5 min)
  ↓
Frontend sends replay request with modified config
  ↓
Backend validates user's org access
  ↓
Backend creates EchosRuntime with ECHOS_SYSTEM_API_KEY
  ↓
Runtime runs workflow with modified config
  ↓
Results streamed back via SSE
```

## Future Improvements

### Cleaner Server-Side Mode
Currently, we use a workaround to bypass API validation for server-side replay. 

**Better solution** (TODO):
```typescript
// Add a server-side mode to EchosRuntime
const runtime = new EchosRuntime({
  mode: 'server-side',
  orgId: orgId,
  // No API key needed - runs locally
});
```

This would:
- ✅ Eliminate the need for a system API key
- ✅ Run workflows entirely server-side
- ✅ Still save traces to the database
- ✅ More secure and simpler

## Deployment Checklist

- [ ] Set `ECHOS_SYSTEM_API_KEY` or `ECHOS_API_KEY`
- [ ] Set `DATABASE_URL`
- [ ] Set `SESSION_SECRET` (long random string)
- [ ] Set `ECHOS_API_URL` to your production API URL
- [ ] Update line 180 in `server/src/traces/traces.service.ts` with your production URL
- [ ] Test Time-Travel Debug in staging before production
- [ ] Set up monitoring for replay errors

