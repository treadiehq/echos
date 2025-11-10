# Memory & Context Management

How Echos manages chat history and context between agents.

---

## The Problem

Multi-agent systems often struggle with context:
- Agent A fetches data, but Agent B can't see it
- Orchestrator forgets what it asked for
- Agents repeat work because they don't know what happened before

**Echos solves this with namespaced memory.**

---

## How Memory Works

Think of memory as a **shared key-value store** with namespaces:

```
memory:
  global: { org_id: "123", env: "prod" }
  orchestrator: { next_step: "analyze" }
  database: { query_result: [...] }
  analysis: { summary: "..." }
```

Each agent:
1. **Reads** from specified namespaces
2. **Writes** to its own namespace
3. Passes context to the next agent

---

## Basic Example

```yaml
memory:
  global:
    org_id: "acme-inc"
    customer_tier: "enterprise"

agents:
  - name: db_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]
        writeTo: "database"
```

**What happens:**

```
1. Orchestrator runs
   Reads: { org_id: "acme-inc", customer_tier: "enterprise" }
   Writes to: "orchestrator" namespace
   
2. db_agent runs
   Reads: { 
     global.org_id: "acme-inc",
     global.customer_tier: "enterprise",
     orchestrator.* 
   }
   Writes to: "database" namespace
   
3. data_agent runs (if configured)
   Reads: { 
     global.*,
     database.query_result: [...]
   }
   Writes to: "analysis" namespace
```

---

## Configuration Reference

### Global Memory

Set at workflow level—available to all agents:

```yaml
memory:
  global:
    environment: "production"
    database_type: "postgresql"
    api_timeout: "30s"
```

**Use for:**
- Configuration values
- Environment settings
- IDs that all agents need

### Agent Memory Policies

Control what each agent can read/write:

```yaml
agents:
  - name: search_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]  # What it can read
        writeTo: "search"  # Where it writes results
```

**readFrom:**
- List of namespaces to access
- Agent sees all keys from those namespaces
- Format: `namespace.key` (e.g., `global.org_id`)

**writeTo:**
- Single namespace where agent stores results
- Automatically created if doesn't exist
- Other agents can read from this namespace

---

## Common Patterns

### Pattern 1: Linear Pipeline

Data flows through agents sequentially:

```yaml
agents:
  - name: db_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]
        writeTo: "database"
        
  - name: data_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "database"]  # Reads db_agent results
        writeTo: "analysis"

routes:
  orchestrator:
    canCall: [db_agent, data_agent]
  db_agent:
    canCall: [data_agent]  # db_agent passes to data_agent
```

**Flow:**
```
User Input → Orchestrator → db_agent → data_agent → Final Result
              ↓              ↓           ↓
            memory/       memory/     memory/
           orchestrator   database    analysis
```

### Pattern 2: Parallel Execution

Multiple agents work independently, final agent combines results:

```yaml
agents:
  - name: db_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]
        writeTo: "database"
        
  - name: search_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator"]
        writeTo: "search"
        
  - name: data_agent
    policy:
      memoryPolicy:
        readFrom: ["global", "database", "search"]  # Combines both
        writeTo: "analysis"

routes:
  orchestrator:
    canCall: [db_agent, search_agent, data_agent]
```

**Flow:**
```
                    → db_agent → memory/database ─┐
User → Orchestrator                               ├→ data_agent → Result
                    → search_agent → memory/search┘
```

### Pattern 3: Iterative Refinement

Agent refines its own output across loops:

```yaml
agents:
  - name: data_agent
    maxLoops: 3
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator", "analysis"]  # Reads own output
        writeTo: "analysis"
```

**Flow:**
```
Loop 1: data_agent writes initial analysis → memory/analysis
Loop 2: data_agent reads previous analysis, refines → memory/analysis
Loop 3: data_agent reads refined analysis, finalizes → memory/analysis
```

---

## Runtime Memory Injection

You can pass memory dynamically at runtime:

```typescript
const result = await runtime.run({
  task: 'Analyze customer data',
  memory: {
    customer_id: '12345',
    date_range: 'last_30_days',
    include_predictions: true
  }
});
```

**This merges with `global` memory:**

```yaml
# workflow.yaml
memory:
  global:
    environment: "production"

# At runtime, agent sees:
{
  global.environment: "production",
  global.customer_id: "12345",
  global.date_range: "last_30_days",
  global.include_predictions: true
}
```

---

## Real-World Example

**Use case:** Query database, analyze results, generate report

```yaml
name: "Analytics Pipeline"

memory:
  global:
    org_id: "acme-inc"
    database_type: "postgresql"

agents:
  - name: orchestrator
    maxLoops: 3
    policy:
      memoryPolicy:
        readFrom: ["global"]
        writeTo: "orchestrator"
    
  - name: db_agent
    maxLoops: 1
    policy:
      retries:
        count: 2
      memoryPolicy:
        readFrom: ["global", "orchestrator"]
        writeTo: "database"
      guardrails:
        allowedOperations: [SELECT]
        
  - name: data_agent
    maxLoops: 2
    policy:
      memoryPolicy:
        readFrom: ["global", "orchestrator", "database"]
        writeTo: "analysis"

routes:
  orchestrator:
    canCall: [db_agent, data_agent]
  db_agent:
    canCall: [data_agent]
```

**Execution:**

```typescript
const result = await runtime.run({
  task: 'Analyze Q4 sales by region',
  memory: {
    quarter: 'Q4',
    year: 2024,
    regions: ['US', 'EU', 'APAC']
  }
});
```

**Memory evolution:**

```
Step 1: Orchestrator
  Reads:  { global.org_id, global.quarter, global.year, global.regions }
  Writes: { orchestrator.task: "query database for Q4 sales" }

Step 2: db_agent
  Reads:  { global.*, orchestrator.task }
  Writes: { database.query: "SELECT ...", database.results: [...] }

Step 3: Orchestrator (Loop 2)
  Reads:  { global.*, database.results }
  Writes: { orchestrator.task: "analyze results" }

Step 4: data_agent
  Reads:  { global.*, orchestrator.*, database.results }
  Writes: { analysis.summary: "...", analysis.insights: [...] }

Step 5: Orchestrator (Loop 3)
  Reads:  { global.*, database.*, analysis.* }
  Writes: { orchestrator.task: "DONE" }
  → Workflow ends
```

---

## Viewing Memory in Traces

Every trace shows memory state:

```json
{
  "taskId": "abc-123",
  "steps": [
    {
      "agent": "db_agent",
      "input": {
        "message": "Query database",
        "payload": {
          "global.org_id": "acme-inc",
          "orchestrator.task": "fetch sales data"
        }
      },
      "output": {
        "payload": {
          "query": "SELECT * FROM sales WHERE ...",
          "results": [...]
        }
      }
    }
  ]
}
```

**View in Web UI:**
- Go to `http://localhost:3000/traces/<task-id>`
- See memory state at each step
- Debug missing context issues

---

## Best Practices

### ✅ DO

1. **Use `global` for shared context**
   ```yaml
   memory:
     global:
       org_id: "123"
       user_role: "admin"
   ```

2. **Let agents write to their own namespace**
   ```yaml
   - name: db_agent
     policy:
       memoryPolicy:
         writeTo: "database"  # Not "global"
   ```

3. **Read from upstream agents**
   ```yaml
   - name: data_agent
     policy:
       memoryPolicy:
         readFrom: ["global", "database"]  # Access db_agent results
   ```

4. **Pass IDs and metadata via runtime memory**
   ```typescript
   await runtime.run({
     task: 'Analyze',
     memory: { user_id: req.user.id }
   });
   ```

### ❌ DON'T

1. **Don't pollute `global` with agent results**
   ```yaml
   # Bad
   - name: db_agent
     policy:
       memoryPolicy:
         writeTo: "global"  # Clutters global namespace
   ```

2. **Don't read from namespaces you don't need**
   ```yaml
   # Bad - search_agent doesn't need database results
   - name: search_agent
     policy:
       memoryPolicy:
         readFrom: ["global", "database", "analysis"]  # Too much
   ```

3. **Don't hardcode sensitive data in workflow.yaml**
   ```yaml
   # Bad
   memory:
     global:
       api_key: "sk-1234..."  # Use environment variables instead
   ```

---

## Advanced: Custom Memory Keys

You can use any key names:

```yaml
memory:
  global:
    company:
      name: "Acme Inc"
      domain: "acme.com"
    features:
      analytics: true
      ml_predictions: false
```

Agents access with dot notation:

```
global.company: { name: "Acme Inc", domain: "acme.com" }
global.features: { analytics: true, ml_predictions: false }
```

---

## Troubleshooting

### Agent can't see previous results

**Cause:** Missing namespace in `readFrom`

**Fix:**
```yaml
- name: data_agent
  policy:
    memoryPolicy:
      readFrom: ["global", "database"]  # Add missing namespace
```

### Memory is too large / slow

**Cause:** Too much data in memory

**Fix:**
- Store only IDs/references, not full data
- Use database for large datasets
- Clean up memory between workflows

### Context gets lost between loops

**Cause:** Agent not reading its own namespace

**Fix:**
```yaml
- name: data_agent
  maxLoops: 3
  policy:
    memoryPolicy:
      readFrom: ["global", "analysis"]  # Read own namespace
      writeTo: "analysis"
```

---

## Summary

| Feature | Purpose | Example |
|---------|---------|---------|
| `global` | Shared config/context | `org_id`, `environment` |
| `readFrom` | What agent can access | `["global", "database"]` |
| `writeTo` | Where agent stores results | `"analysis"` |
| Runtime memory | Dynamic context injection | `{ user_id: "123" }` |
| Traces | View memory evolution | Web UI or JSON |

**Key insight:** Memory is how agents "talk" to each other. Design your namespaces to match your data flow.

