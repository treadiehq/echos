# Embedding Echos in Your Application

This guide shows you how to integrate Echos Runtime into your application.

---

## Quick Start

### 1. Install Echos

```bash
npm install @echoshq/runtime
```

### 2. Get your API key

1. Start Echos: `npm run start`
2. Sign up at `http://localhost:3000/signup`
3. Go to Settings and create an API key
4. Add it to your `.env` file

### 3. Use it in your code

```typescript
import { EchosRuntime, loadWorkflow, builtInAgents } from '@echoshq/runtime';

const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY,    // Required
    apiUrl: 'http://localhost:4000'        // Required
  }
);

const result = await runtime.run({
  task: 'Analyze sales data for Q4',
  memory: { year: 2024 }
});

console.log(result);
```

---

## Integration Examples

### Next.js API Route

```typescript
// app/api/analyze/route.ts
import { EchosRuntime, loadWorkflow, builtInAgents } from '@echoshq/runtime';
import { NextRequest, NextResponse } from 'next/server';

// Initialize runtime once (singleton)
const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY!,
    apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
  }
);

export async function POST(request: NextRequest) {
  const { task, customerId } = await request.json();

  try {
    const result = await runtime.run({
      task,
      memory: { customerId }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Usage from frontend:**

```typescript
async function analyzeData() {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Analyze customer sentiment from last 100 tickets',
      customerId: '123'
    })
  });

  const result = await response.json();
  console.log('Analysis:', result);
}
```

---

### Express.js Service

```typescript
import express from 'express';
import { EchosRuntime, loadWorkflow, builtInAgents } from '@echoshq/runtime';

const app = express();
app.use(express.json());

// Initialize runtime
const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY!,
    apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
  }
);

app.post('/api/agents/run', async (req, res) => {
  const { task, memory } = req.body;

  try {
    const result = await runtime.run({ task, memory });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Workflow Configuration

Create `workflow.yaml` in your project:

```yaml
name: "My Workflow"

agents:
  orchestrator:
    model: claude-3-5-sonnet-20241022
    canCall: [code_agent, search_agent, data_agent]
    
  code_agent:
    model: claude-3-5-sonnet-20241022
    canCall: []
    
  search_agent:
    model: claude-3-5-sonnet-20241022
    canCall: [data_agent]
    
  data_agent:
    model: claude-3-5-sonnet-20241022
    canCall: []

routes:
  orchestrator: [code_agent, search_agent, data_agent]
  code_agent: []
  search_agent: [data_agent]
  data_agent: []
```

The orchestrator automatically routes tasks to the appropriate specialized agent.

---

## Environment Variables

```bash
# Required
ECHOS_API_KEY=ek_test_your_key_here
OPENAI_API_KEY=sk-your-openai-key

# Optional
ECHOS_API_URL=http://localhost:4000  # Defaults to localhost:4000
ANTHROPIC_API_KEY=sk-ant-...         # If using Claude models
```

---

## Viewing Traces

All workflow executions are automatically traced and visible in the Echos UI:

1. Go to `http://localhost:3000`
2. Click on any trace to see:
   - Agent routing decisions
   - LLM calls and responses
   - Execution time and costs
   - Errors and debugging info

This makes debugging much easier than reading logs!

---

## Built-in Agents

Echos includes these pre-built agents:

- **`orchestrator`** - Routes tasks to specialized agents
- **`code_agent`** - Generates and analyzes code
- **`search_agent`** - Searches the web
- **`data_agent`** - Analyzes and summarizes data
- **`api_agent`** - Makes HTTP API calls
- **`db_agent`** - Queries databases

You can use any combination in your workflow.

---

## Production Checklist

### Security

- [ ] Use environment variables for API keys (never hardcode)
- [ ] Rotate API keys regularly
- [ ] Use separate API keys for dev/staging/prod
- [ ] Review agent permissions in workflow.yaml

### Monitoring

- [ ] Check traces regularly in the Echos UI
- [ ] Monitor workflow success/failure rates
- [ ] Track execution times
- [ ] Watch for cost spikes

### Performance

- [ ] Initialize runtime once (singleton pattern)
- [ ] Don't create new runtime per request
- [ ] Set reasonable timeouts
- [ ] Monitor memory usage

### Cost Management

- [ ] Monitor LLM token usage in traces
- [ ] Use appropriate models (Claude Haiku for simple tasks)
- [ ] Review agent prompts for efficiency
- [ ] Set up billing alerts with your LLM provider

---

## Troubleshooting

### "No API key provided"

Make sure you have both required environment variables:

```bash
export ECHOS_API_KEY=ek_test_your_key
export OPENAI_API_KEY=sk-your-key
```

### "401 Unauthorized"

Your API key is invalid or expired. Generate a new one:
1. Go to `http://localhost:3000/settings`
2. Create a new API key
3. Update your `.env` file

### "Route not permitted"

Check your `workflow.yaml` - the orchestrator is trying to call an agent that's not in its `canCall` list.

```yaml
agents:
  orchestrator:
    canCall: [code_agent, data_agent]  # Add the agent here
```

### Can't see traces in the UI

Make sure:
1. The Echos server is running (`npm run start`)
2. You're using the correct `apiUrl` in your runtime config
3. Your API key is valid

---

## Next Steps

- **Examples:** Check the `examples/` folder for workflow templates
- **Workflow YAML:** See `workflow.yaml` for configuration reference
- **GitHub Issues:** Report bugs at https://github.com/treadiehq/echos/issues

---
