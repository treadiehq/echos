# Echos

**A lightweight multi-agent workflow runtime with intelligent routing, execution tracing, and guardrails.**

Build AI workflows with multiple agents, see exactly what's happening in real-time, and debug with confidence.

---

## What is Echos?

Echos lets you:
- **Coordinate multiple AI agents** - Let different agents handle different tasks
- **See what's happening** - Watch your agents work in real-time
- **Debug easily** - Visual traces show you exactly what went wrong
- **Use it anywhere** - Secure API keys and multi-tenant support

---

## Quick Start

```bash
# 1. Clone and start the platform
git clone https://github.com/treadiehq/echos.git
cd echos
npm install
npm run start

# 2. Sign up at http://localhost:3000/signup and get your API key

# 3. Install in your project
npm install @echoshq/runtime

# 4. Use it (CLI or programmatically)

# Quick test with CLI:
npx echos "Analyze customer data from the database"

# Or use in your code:
import { EchosRuntime } from '@echoshq/runtime';

const runtime = new EchosRuntime({
  workflow: './workflow.yaml',  // optional
  apiKey: process.env.ECHOS_API_KEY
});

await runtime.run('Your task here');

# 5. Watch traces at http://localhost:3000
```

**→ See [Embedding](docs/EMBEDDING_GUIDE.md) for integration examples**

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start everything |
| `npm run stop` | Stop everything |
| `npm run restart` | Restart everything |
| `npm run echos -- "task"` | Run a workflow task (dev) |

---

## What's Next?

- **[Embedding](docs/EMBEDDING_GUIDE.md)** - Integrate Echos into your app
- **[workflow.yaml](workflow.yaml)** - See example workflow configuration
- **[examples/](examples/)** - Pre-built workflow templates

---

## License

FSL-1.1-MIT. See LICENSE for details.
