# Production Deployment Guide

Guide to deploying Echos reliably in production.

---

## Architecture Overview

Echos consists of three components:

```
┌─────────────────┐
│  Your App       │
│  (Next.js, etc) │
└────────┬────────┘
         │ @echoshq/runtime
         ▼
┌─────────────────┐      ┌──────────────┐
│  Echos API      │─────▶│  PostgreSQL  │
│  (Node + NestJS)│      │  (traces)    │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  Echos Web UI   │
│  (Nuxt 3)       │
└─────────────────┘
```

**Runtime:** Embedded in your app (NPM package)  
**API:** Stores traces, manages API keys  
**Web UI:** Visualize workflows and debug  
**Database:** PostgreSQL for trace storage

---

## Reliability Best Practices

### 1. Loop Limiting (Prevent Rogue Agents)

**Problem:** Agents can get stuck in infinite loops, burning through tokens and money.

**Solution:** Set `maxLoops` per agent:

```yaml
agents:
  - name: orchestrator
    maxLoops: 3  # Hard stop after 3 loops
    
  - name: db_agent
    maxLoops: 1  # Query agents typically only need 1 loop
    
  - name: data_agent
    maxLoops: 2  # Analysis may need refinement

limits:
  defaultMaxLoops: 3  # Fallback if agent doesn't specify
```

**Industry standard:** Cursor uses 25 loops max. We recommend:
- Orchestrator: 3-5 loops
- Worker agents (db, api, search): 1-2 loops
- Analysis agents: 2-3 loops

### 2. Cost Ceilings

**Problem:** A single misbehaving workflow could rack up hundreds of dollars in LLM costs.

**Solution:** Set cost limits at workflow and agent levels:

```yaml
limits:
  maxCost: 5.0  # Workflow stops if total cost exceeds $5

agents:
  - name: data_agent
    policy:
      guardrails:
        maxCostPerInvocation: 1.5  # This agent stops if it costs > $1.50 per call
```

**Recommendations:**
- Development: `maxCost: 0.50` per workflow
- Production: `maxCost: 5.0` per workflow
- High-value tasks: `maxCost: 10.0`

**Monitor costs in traces:**
```bash
# View cost breakdown
cat traces/<task-id>.json | jq '.steps[].metadata.cost'
```

### 3. Timeout Protection

**Problem:** Long-running workflows can hang or waste resources.

**Solution:** Set maximum duration:

```yaml
limits:
  maxDurationMs: 30000  # 30 seconds

# Or per-agent (coming soon)
agents:
  - name: api_agent
    policy:
      timeout: 15000  # 15 seconds
```

**Recommendations:**
- Simple queries: 10-30 seconds
- Complex analysis: 60 seconds
- Multi-step workflows: 120 seconds

### 4. Retry Logic with Backoff

**Problem:** APIs and databases can be flaky. One transient error shouldn't fail the entire workflow.

**Solution:** Configure retries per agent:

```yaml
agents:
  - name: api_agent
    policy:
      retries:
        count: 3  # Retry up to 3 times
        backoffMs: 1000  # Wait 1 second between retries (exponential backoff)
```

**Recommendations:**
- API agents: 3 retries (external services can be flaky)
- Database agents: 2 retries (usually reliable)
- LLM agents: 1 retry (usually fast recovery)

### 5. Guardrails (Safety Rules)

**Prevent dangerous operations:**

```yaml
# Database Agent
agents:
  - name: db_agent
    policy:
      guardrails:
        allowedOperations: [SELECT, INSERT, UPDATE]  # No DELETE or DROP
        requireWhere: true  # Prevent accidental full-table operations
        allowedTables: [users, orders, analytics]  # Whitelist tables

# API Agent
agents:
  - name: api_agent
    policy:
      guardrails:
        allowedDomains: [api.stripe.com, api.github.com]  # Prevent SSRF
        allowedMethods: [GET, POST]  # No DELETE
        blockPrivateIPs: true  # Block internal network access
```

### 6. Memory Management (Chat History)

**Problem:** Agents lose context between steps, leading to repeated work or errors.

**Solution:** Use namespaced memory:

```yaml
memory:
  global:
    org_id: "acme-inc"
    environment: "production"

agents:
  - name: db_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]  # Read shared context
        writeTo: "database"  # Store query results
        
  - name: data_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "database"]  # Access db_agent results
        writeTo: "analysis"  # Store analysis results
```

**How it works:**
1. Orchestrator reads task + global memory
2. Calls `db_agent`, which writes results to `database` namespace
3. Calls `data_agent`, which reads from `database` namespace
4. Full context preserved throughout workflow

**Best practices:**
- Store IDs and metadata in `global`
- Store agent results in agent-specific namespaces
- Use `readFrom` to control what each agent sees

---

## Monitoring & Observability

### Trace Visualization

Every workflow execution creates a trace:

```bash
# View trace in Web UI
http://localhost:3000/traces/<task-id>

# Or read JSON directly
cat traces/<task-id>.json
```

**What's in a trace:**
- Every agent invocation
- Input/output for each step
- LLM model used + tokens + cost
- Retry attempts
- Memory state changes
- Errors and warnings

### Error Alerting

**Current:** Traces are stored in PostgreSQL

**Coming soon:** Slack/Discord webhooks on errors

**Workaround:** Poll the API for failed workflows:

```typescript
// Check for failures
const response = await fetch(`${ECHOS_API_URL}/traces?status=error`, {
  headers: { Authorization: `Bearer ${ECHOS_API_KEY}` }
});

const failures = await response.json();
if (failures.length > 0) {
  // Send to Slack
  await sendSlackAlert(failures);
}
```

### Cost Monitoring

**Track costs per workflow:**

```typescript
const result = await runtime.run('Analyze data');
console.log('Total cost:', result.totals.cost);

// Set up alerts if cost exceeds threshold
if (result.totals.cost > 1.0) {
  await alertCostExceeded(result);
}
```

**View cost trends:**

```bash
# Get all traces from last 24h
curl -H "Authorization: Bearer $ECHOS_API_KEY" \
  "http://localhost:4000/traces?since=24h" | \
  jq '[.[] | .totals.cost] | add'
```

---

## Model Selection & Flexibility

### Switching Between Providers

**OpenAI:**
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o  # or gpt-4, gpt-3.5-turbo
```

**Anthropic:**
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # or claude-3-opus, claude-3-haiku
```

### Model Selection Strategy

| Task Type | Recommended Model | Why |
|-----------|------------------|-----|
| Simple routing (orchestrator) | GPT-3.5 / Claude Haiku | Fast, cheap, good enough |
| Complex analysis | GPT-4o / Claude Sonnet | Better reasoning |
| Code generation | GPT-4o / Claude Sonnet | Accurate code output |
| Data summarization | Claude Haiku | Cost-effective, fast |

**Coming soon:** Per-agent model selection:
```yaml
agents:
  - name: orchestrator
    model: gpt-3.5-turbo  # Fast routing
    
  - name: data_agent
    model: claude-3-5-sonnet-20241022  # Deep analysis
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

Included `docker-compose.yml`:

```bash
# Start everything
docker-compose up -d

# Services:
# - API: http://localhost:4000
# - Web UI: http://localhost:3000
# - PostgreSQL: localhost:5432
```

### Option 2: Kubernetes

See `k8s/` folder (coming soon)

### Option 3: Individual Services

```bash
# Terminal 1: Database
docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Terminal 2: API
cd server && npm run build && node dist/main.js

# Terminal 3: Web UI
cd web && npm run build && node .output/server/index.mjs
```

---

## Scaling Considerations

### Horizontal Scaling

The runtime is **stateless**—scale by running multiple instances of your app:

```
┌──────────────┐
│  App (Pod 1) │───┐
└──────────────┘   │
                   ├──▶ Echos API ──▶ PostgreSQL
┌──────────────┐   │
│  App (Pod 2) │───┘
└──────────────┘
```

### Database Scaling

For high-volume workflows:
- Use PostgreSQL read replicas for trace queries
- Set up connection pooling (PgBouncer)
- Archive old traces (> 30 days)

### LLM Rate Limits

**OpenAI:** 10,000 requests/minute (Tier 4)  
**Anthropic:** 1,000 requests/minute (free tier)

If you hit rate limits:
- Use retries with backoff (built-in)
- Implement request queuing (coming soon)
- Spread load across multiple API keys

---

## Security Checklist

- [ ] Use environment variables for all API keys
- [ ] Rotate Echos API keys every 90 days
- [ ] Use separate keys for dev/staging/prod
- [ ] Enable guardrails on all agents
- [ ] Use read replicas for database agents
- [ ] Set cost ceilings on all workflows
- [ ] Enable `blockPrivateIPs` on API agents
- [ ] Review allowed tables/domains regularly
- [ ] Monitor traces for suspicious activity
- [ ] Use HTTPS in production (reverse proxy)

---

## Performance Optimization

### 1. Runtime Singleton

**❌ Bad (creates new runtime per request):**
```typescript
app.post('/api/run', async (req, res) => {
  const runtime = new EchosRuntime({ workflow: './workflow.yaml' });
  const result = await runtime.run(req.body.task);
  res.json(result);
});
```

**✅ Good (reuse runtime):**
```typescript
const runtime = new EchosRuntime({ workflow: './workflow.yaml' });

app.post('/api/run', async (req, res) => {
  const result = await runtime.run(req.body.task);
  res.json(result);
});
```

### 2. Choose the Right Model

- Use cheaper models (GPT-3.5, Claude Haiku) for simple tasks
- Reserve GPT-4/Sonnet for complex analysis
- Orchestrator doesn't need GPT-4—routing is simple

### 3. Optimize Loop Counts

Lower `maxLoops` = faster execution + lower cost:

```yaml
agents:
  - name: orchestrator
    maxLoops: 2  # Most workflows complete in 2 loops
```

### 4. Cache Common Results

Use memory to avoid repeating work:

```typescript
const result = await runtime.run({
  task: 'Analyze data',
  memory: {
    cached_schema: await getDBSchema(),  // Don't re-fetch schema
    previous_results: cache.get('last_analysis')
  }
});
```

---

## Troubleshooting

### "Agent exceeded loop limit"

**Cause:** Agent is stuck in a loop  
**Fix:** Lower `maxLoops` or improve agent prompt

### "Cost ceiling exceeded"

**Cause:** Workflow used too many tokens  
**Fix:** 
- Increase `maxCost` in `limits`
- Use a cheaper model
- Optimize prompts

### "Route not permitted"

**Cause:** Orchestrator tried to call an agent not in `canCall`  
**Fix:** Update `routes` in workflow.yaml

### Workflows are slow

**Causes:**
- API latency (external services)
- Large LLM context (many tokens)
- Too many retries

**Fixes:**
- Use faster models (Haiku > Sonnet)
- Reduce context size
- Lower retry counts

---

## Support

- **GitHub Issues:** https://github.com/treadiehq/echos/issues
- **Docs:** `/docs` folder
- **Examples:** `/examples` folder

