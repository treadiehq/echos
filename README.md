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

### 1. Start the platform

```bash
npm install
npm run start
```

This starts everything: database, API server, and web UI.

### 2. Sign up

Open `http://localhost:3000/signup` and create an account.

### 3. Get your API key

Go to Settings and create an API key.

### 4. Run your first workflow

```typescript
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';

const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY,
    apiUrl: 'http://localhost:4000'
  }
);

const result = await runtime.run({
  task: 'Tell me a programming joke',
  memory: {}
});

console.log(result);
```

### 5. Watch it run

Go to `http://localhost:3000` and watch your agents work in real-time! 🎉

---

## How it works

1. **Define your workflow** - Create a `workflow.yaml` file with your agents
2. **Run tasks** - Use the Echos runtime in your code
3. **Watch the magic** - See traces in the web UI as agents execute
4. **Debug & iterate** - Click into any trace to see the full execution

---

## What's a workflow?

A workflow is just a YAML file that defines your agents:

```yaml
name: "Multi-Agent Orchestrator"

agents:
  orchestrator:
    model: claude-3-5-sonnet-20241022
    canCall: [code_agent, search_agent, data_agent]
    
  code_agent:
    model: claude-3-5-sonnet-20241022
    canCall: []
```

The orchestrator routes tasks to specialized agents. Each agent can call other agents.

---

## Useful commands

| Command | What it does |
|---------|-------------|
| `npm run start` | Start everything |
| `npm run stop` | Stop everything |
| `npm run restart` | Restart everything |
| `npm run dev:api` | API server only |
| `npm run dev:ui` | Web UI only |

---

## Environment variables

Create a `.env` file:

```env
# AI Provider Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Your Echos API Key (get from Settings)
ECHOS_API_KEY=your-api-key
ECHOS_API_URL=http://localhost:4000

# Email (for magic links)
RESEND_API_KEY=re_...

# Database (auto-configured)
DATABASE_URL=postgresql://user:password@localhost:5432/echos
JWT_SECRET=your-secret-key
```

---

## Need help?

- 📖 Check the code examples in `test-echos.mjs`
- 🐛 Look at traces in the UI to debug
- 💡 Modify `workflow.yaml` to add more agents

---

## License

FSL-1.1-MIT. See LICENSE for details.
