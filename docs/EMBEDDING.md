# Embedding Echos in Your Application

This guide shows you how to integrate Echos into Next.js, Express, and other Node.js applications.

---

## Prerequisites

1. **Start the Echos platform:**
   ```bash
   git clone https://github.com/treadiehq/echos.git
   cd echos && npm install && npm run start
   ```

2. **Get your API key:**
   - Sign up at `http://localhost:3000/signup`
   - Go to Settings → Create API key
   - Add to your `.env`: `ECHOS_API_KEY=ek_test_...`

3. **Install the runtime:**
   ```bash
   npm install @echoshq/runtime
   ```

---

## Integration Examples

### Next.js API Route

```typescript
// app/api/analyze/route.ts
import { EchosRuntime } from '@echoshq/runtime';
import { NextRequest, NextResponse } from 'next/server';

// Initialize runtime once (singleton)
const runtime = new EchosRuntime({
  workflow: './workflow.yaml',  // optional
  apiKey: process.env.ECHOS_API_KEY!,
  apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
});

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
import { EchosRuntime } from '@echoshq/runtime';

const app = express();
app.use(express.json());

// Initialize runtime
const runtime = new EchosRuntime({
  workflow: './workflow.yaml',  // optional
  apiKey: process.env.ECHOS_API_KEY!,
  apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
});

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

Create `workflow.yaml` (see [workflow.yaml](../workflow.yaml) for full example):

```yaml
name: "My Workflow"

agents:
  orchestrator:
    model: claude-3-5-sonnet-20241022
    canCall: [code_agent, search_agent]
```

**Built-in agents:** orchestrator, code_agent, search_agent, data_agent, api_agent, db_agent

---

## Environment Variables

```bash
# Required
ECHOS_API_KEY=ek_test_...        # From Settings page

# LLM Provider - Choose one:
# Option 1: OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o              # or gpt-4, gpt-3.5-turbo

# Option 2: Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # or claude-3-opus, claude-3-haiku

# Optional
ECHOS_API_URL=http://localhost:4000
```

**Model Selection Guide:**

| Use Case | Recommended Model | Cost | Speed |
|----------|------------------|------|-------|
| Simple routing | GPT-3.5 / Claude Haiku | $ | ⚡⚡⚡ |
| Complex analysis | GPT-4o / Claude Sonnet | $$$ | ⚡ |
| Code generation | GPT-4o / Claude Sonnet | $$$ | ⚡ |
| Data summarization | Claude Haiku | $ | ⚡⚡⚡ |

**Switch models instantly:**
```bash
# Development: Use cheap models
export LLM_PROVIDER=openai
export OPENAI_MODEL=gpt-3.5-turbo

# Production: Use powerful models
export LLM_PROVIDER=anthropic
export ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

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
