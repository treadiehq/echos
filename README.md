# Echos

**A lightweight multi-agent AI systems.** Stop rebuilding orchestrators, database agents, and retry logic. Just define your workflow in YAML, customize with your data, and ship.

---

## The Problem

Building multi-agent AI systems means rebuilding the same things over and over:
- Orchestrators that route tasks
- Database agents with SQL guardrails  
- Retry logic and backoff strategies
- Loop limiting (preventing rogue agents)
- Cost tracking and observability

**Most frameworks are bulky and complex.** You just want pre-built components you can compose—like AWS services.

---

## The Solution

Echos lets you:

Coordinate multiple AI agents - Let different agents handle different tasks
See what's happening - Watch your agents work in real-time
Debug easily - Visual traces show you exactly what went wrong

Echos gives you **pre-built agent "services"** you compose like AWS:

| What You Need | Echos Agent | What It Does |
|---------------|-------------|--------------|
| Query databases | `db_agent` | SQL with guardrails (no DELETE/DROP) |
| Call HTTP APIs | `api_agent` | SSRF protection, domain whitelisting |
| Search the web | `search_agent` | Serper/Brave integration |
| Analyze data | `data_agent` | Summaries, insights, charts |
| Generate code | `code_agent` | Multi-language code generation |
| Route tasks | `orchestrator` | Intelligent task routing |

Define your "architecture" in YAML (not code):

```yaml
agents:
  - name: orchestrator
    maxLoops: 3
    
  - name: db_agent
    policy:
      guardrails:
        allowedTables: [users, orders]
        allowedOperations: [SELECT]
      retries:
        count: 2
        backoffMs: 300

routes:
  orchestrator:
    canCall: [db_agent, data_agent]
```

Use anywhere:

```typescript
import { EchosRuntime } from '@echoshq/runtime';

const runtime = new EchosRuntime({ 
  workflow: './workflow.yaml',
  apiKey: process.env.ECHOS_API_KEY
});

await runtime.run('Analyze Q4 sales by region');
```

---

## Features

- **Loop Limiting** - Set `maxLoops` per agent to prevent infinite loops
- **Retry Logic** - Automatic retries with exponential backoff
- **Cost Ceilings** - Per-agent and per-workflow cost limits
- **Memory Management** - Agents share context through namespaced memory
- **Multi-LLM** - OpenAI (GPT-3.5, GPT-4, GPT-4o) or Anthropic (Claude)
- **Visual Traces** - See what happened, where it failed, and costs
- **Guardrails** - SQL injection protection, SSRF blocking, table/domain whitelisting

---

## Quick Start

```bash
# Start the platform
git clone https://github.com/treadiehq/echos.git
cd echos && npm install && npm run start

# Sign up at http://localhost:3000/signup and get your API key

# Install in your project
npm install @echoshq/runtime

# Use it
npx echos "Analyze customer data from the database"

# Or in code
import { EchosRuntime } from '@echoshq/runtime';

const runtime = new EchosRuntime({
  workflow: './workflow.yaml',  // optional
  apiKey: process.env.ECHOS_API_KEY
});

await runtime.run('Your task');
```

View traces at http://localhost:3000

---

## Docs

- **[Production](docs/PRODUCTION.md)** - Reliability, monitoring, scaling
- **[Memory](docs/MEMORY.md)** - How agents share context
- **[Embedding](docs/EMBEDDING.md)** - Integrate into your app
- **[Examples](examples/README.md)** - Pre-built templates
- **[workflow.yaml](workflow.yaml)** - Configuration reference

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start everything |
| `npm run stop` | Stop everything |
| `npm run restart` | Restart everything |
| `npm run echos -- "task"` | Run a task (dev) |

---

## License

FSL-1.1-MIT - See [LICENSE](LICENSE)
