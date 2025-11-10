# 🚀 Echos Runtime: Embedding Guide

This guide shows you how to embed Echos Runtime into your product in **3 different ways**, from simplest to most scalable.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Scenario 1: In-Process Library](#scenario-1-in-process-library-embedded)
3. [Scenario 2: Sidecar Service](#scenario-2-sidecar-service-docker)
4. [Scenario 3: Microservice](#scenario-3-microservice-kubernetes)
5. [Custom Agents](#custom-agents)
6. [Configuration](#configuration)
7. [Multi-Tenancy](#multi-tenancy)
8. [Production Checklist](#production-checklist)

---

## Quick Start

### Installation

```bash
# Via npm
npm install echos

# Via Docker
docker pull echoshq/echos:latest

# Via Helm (Kubernetes)
helm repo add echos https://charts.echos.ai
helm install echos echos/echos
```

---

## Scenario 1: In-Process Library (Embedded)

**Use case:** You want the simplest integration, running Echos in the same process as your app.

**Pros:**
- ✅ Simplest to set up
- ✅ No additional services to deploy
- ✅ Direct function calls (no network latency)

**Cons:**
- ❌ Shares resources with your main app
- ❌ Harder to scale independently
- ❌ Memory overhead

---

### Example: Next.js API Route

```typescript
// app/api/analyze/route.ts
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';
import { NextRequest, NextResponse } from 'next/server';

// Initialize runtime once (singleton)
const workflow = loadWorkflow('./workflow.yaml');
const runtime = new EchosRuntime(workflow, builtInAgents);

export async function POST(request: NextRequest) {
  const { task, customerId } = await request.json();

  try {
    const result = await runtime.run({
      task,
      memory: { customerId }
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Usage from frontend:**

```typescript
// components/AnalysisButton.tsx
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

### Example: Express.js Service

```typescript
// server.ts
import express from 'express';
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';

const app = express();
app.use(express.json());

// Initialize runtime
const workflow = loadWorkflow('./workflow.yaml');
const runtime = new EchosRuntime(workflow, builtInAgents);

app.post('/api/agents/run', async (req, res) => {
  const { task, memory } = req.body;

  try {
    const result = await runtime.run({ task, memory });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

### Workflow Configuration

Create `workflow.yaml` in your project root:

```yaml
agents:
  - name: orchestrator
    type: orchestrator
    maxLoops: 5

  - name: db_agent
    type: worker
    maxLoops: 2
    policy:
      guardrails:
        allowedOperations: [SELECT, INSERT, UPDATE]
        allowedTables: [users, orders, analytics]
        requireWhere: true

  - name: search_agent
    type: worker
    maxLoops: 1

  - name: data_agent
    type: worker
    maxLoops: 2

routes:
  orchestrator:
    canCall: [db_agent, search_agent, data_agent]
  db_agent:
    canCall: [orchestrator]
  search_agent:
    canCall: [orchestrator]
  data_agent:
    canCall: [orchestrator]

limits:
  maxCost: 1.00
  maxDurationMs: 30000
  defaultMaxLoops: 3
```

---

## Scenario 2: Sidecar Service (Docker)

**Use case:** You want to run Echos as a separate service alongside your app, using Docker Compose.

**Pros:**
- ✅ Resource isolation
- ✅ Easy to deploy with Docker Compose
- ✅ Can scale independently
- ✅ Shared across multiple app instances

**Cons:**
- ❌ Network latency (small)
- ❌ Additional service to manage

---

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Your main application
  app:
    build: .
    container_name: my-app
    ports:
      - "3000:3000"
    environment:
      ECHOS_URL: http://echos-api:4000
    depends_on:
      - echos-api

  # Echos API sidecar
  echos-api:
    image: echoshq/echos:latest
    container_name: echos-api
    ports:
      - "4000:4000"  # API
      - "3001:3000"  # Web UI
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DATABASE_URL: postgresql://user:pass@postgres:5432/db
    volumes:
      - ./workflow.yaml:/app/workflow.yaml:ro
      - echos-traces:/app/traces

  # PostgreSQL (optional)
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  echos-traces:
  postgres-data:
```

---

### Client Code (Your App)

```typescript
// lib/echos-client.ts
export class EchosClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.ECHOS_URL || 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async run(task: string, memory: Record<string, any> = {}) {
    const response = await fetch(`${this.baseUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, memory })
    });

    if (!response.ok) {
      throw new Error(`Echos Runtime error: ${response.statusText}`);
    }

    return await response.json();
  }

  async getTrace(taskId: string) {
    const response = await fetch(`${this.baseUrl}/api/traces/${taskId}`);
    return await response.json();
  }
}

// Usage
const echos = new EchosClient();
const result = await echos.run('Analyze customer churn');
```

---

### Start the Stack

```bash
# Create .env file
echo "OPENAI_API_KEY=sk-your-key" > .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f echos-api

# Access Web UI
open http://localhost:3001
```

---

## Scenario 3: Microservice (Kubernetes)

**Use case:** You need production-grade deployment with autoscaling, high availability, and monitoring.

**Pros:**
- ✅ Production-ready
- ✅ Auto-scaling
- ✅ High availability
- ✅ Resource management
- ✅ Built-in health checks

**Cons:**
- ❌ Most complex setup
- ❌ Requires K8s knowledge

---

### Kubernetes Deployment

Create `k8s/echos.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: echos

---
apiVersion: v1
kind: Secret
metadata:
  name: echos-secrets
  namespace: echos
type: Opaque
stringData:
  openai-key: sk-your-openai-key-here
  database-url: postgresql://user:pass@postgres.echos.svc.cluster.local:5432/echos

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: echos-config
  namespace: echos
data:
  workflow.yaml: |
    agents:
      - name: orchestrator
        type: orchestrator
        maxLoops: 5
      - name: db_agent
        type: worker
        maxLoops: 2
    routes:
      orchestrator:
        canCall: [db_agent]
    limits:
      maxCost: 1.00

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echos
  namespace: echos
spec:
  replicas: 3
  selector:
    matchLabels:
      app: echos
  template:
    metadata:
      labels:
        app: echos
    spec:
      containers:
      - name: echos
        image: echoshq/echos:latest
        ports:
        - containerPort: 4000
          name: api
        - containerPort: 3000
          name: ui
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: echos-secrets
              key: openai-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: echos-secrets
              key: database-url
        - name: PORT
          value: "4000"
        volumeMounts:
        - name: config
          mountPath: /app/workflow.yaml
          subPath: workflow.yaml
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: echos-config

---
apiVersion: v1
kind: Service
metadata:
  name: echos
  namespace: echos
spec:
  selector:
    app: echos
  ports:
  - name: api
    port: 4000
    targetPort: 4000
  - name: ui
    port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echos
  namespace: echos
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
  - host: echos.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: echos
            port:
              number: 3000
  - host: api.echos.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: echos
            port:
              number: 4000
  tls:
  - hosts:
    - echos.yourdomain.com
    - api.echos.yourdomain.com
    secretName: echos-tls
```

---

### Deploy to Kubernetes

```bash
# Apply configuration
kubectl apply -f k8s/echos.yaml

# Check status
kubectl get pods -n echos
kubectl logs -f deployment/echos -n echos

# Scale up/down
kubectl scale deployment/echos --replicas=5 -n echos

# Access UI (port-forward for testing)
kubectl port-forward svc/echos 3000:3000 -n echos
```

---

### Helm Installation (Easier)

```bash
# Add Helm repo
helm repo add echos https://charts.echos.ai
helm repo update

# Install with custom values
helm install echos echos/echos \
  --namespace echos \
  --create-namespace \
  --set secrets.openaiKey=sk-your-key \
  --set replicas=3 \
  --set ingress.enabled=true \
  --set ingress.host=echos.yourdomain.com
```

---

## Custom Agents

Add your own domain-specific agents without forking Echos.

### Building a Custom Agent

```typescript
// agents/slack_agent.ts
import type { Agent } from 'echos';

export const slack_agent: Agent = {
  name: 'slack_agent',
  kind: 'worker',
  async handle(ctx, input) {
    const { channel, message } = input.payload;

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel,
          text: message || input.message
        })
      });

      const data = await response.json();

      if (!data.ok) {
        return {
          ok: false,
          message: `Slack error: ${data.error}`,
          payload: { error: data.error }
        };
      }

      return {
        ok: true,
        message: `Message sent to #${channel}`,
        payload: { 
          timestamp: data.ts,
          channel: data.channel 
        }
      };
    } catch (error) {
      return {
        ok: false,
        message: `Failed to send Slack message: ${error.message}`,
        payload: { error: error.message }
      };
    }
  }
};
```

---

### Registering Custom Agents

```typescript
// app/services/agents.ts
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';
import { slack_agent } from './agents/slack_agent';
import { jira_agent } from './agents/jira_agent';

const workflow = loadWorkflow('./workflow.yaml');

// Add your custom agents to the built-in ones
const runtime = new EchosRuntime(workflow, [
  ...builtInAgents,
  slack_agent,
  jira_agent
]);

export { runtime };
```

---

### Update Workflow Config

```yaml
agents:
  - name: orchestrator
    type: orchestrator
  
  # Built-in agents
  - name: db_agent
    type: worker
  
  # Your custom agents
  - name: slack_agent
    type: worker
    maxLoops: 1
  
  - name: jira_agent
    type: worker
    maxLoops: 1

routes:
  orchestrator:
    canCall: [db_agent, slack_agent, jira_agent]
  slack_agent:
    canCall: [orchestrator]
  jira_agent:
    canCall: [orchestrator]
```

---

## Configuration

### Programmatic Configuration

Instead of using environment variables, you can configure Echos programmatically:

```typescript
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';

const runtime = new EchosRuntime(workflow, builtInAgents, {
  // LLM Configuration
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo',
    temperature: 0.7
  },
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    poolSize: 10
  },
  
  // Trace storage
  traceStorage: {
    type: 'postgres', // or 'file', 's3', 'gcs'
    connectionString: process.env.DATABASE_URL
  },
  
  // Limits (override workflow.yaml)
  limits: {
    maxCost: 5.00,
    maxDurationMs: 60000,
    defaultMaxLoops: 5
  },
  
  // Logging
  logging: {
    enabled: true,
    level: 'info'
  }
});
```

---

### Environment Variables

```bash
# LLM Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4

# Alternative: Anthropic
# ANTHROPIC_API_KEY=sk-ant-your-key
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Search APIs (optional)
SERPER_API_KEY=your-serper-key
BRAVE_API_KEY=your-brave-key

# Security
ENABLE_CODE_EXECUTION=false
CODE_EXECUTION_TIMEOUT=30000

# Storage
TRACE_DIR=./traces

# API Server
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Logging
ECHOS_LOGS=1
```

---

## Multi-Tenancy

If your product serves multiple customers, you can isolate their workflows and data:

```typescript
import { EchosRuntime, loadWorkflow, builtInAgents } from 'echos';

const workflow = loadWorkflow('./workflow.yaml');
const runtime = new EchosRuntime(workflow, builtInAgents);

// Pass tenant ID with each request
app.post('/api/agents/run', async (req, res) => {
  const tenantId = req.user.organizationId; // from auth middleware
  const { task, memory } = req.body;

  const result = await runtime.run({
    task,
    memory: {
      ...memory,
      tenantId  // Inject tenant context
    }
  });

  // Traces will be tagged with tenantId
  res.json(result);
});
```

---

### Tenant-Specific Workflows

```typescript
// Load different workflow configs per tenant
function getWorkflowForTenant(tenantId: string) {
  return loadWorkflow(`./workflows/${tenantId}.yaml`);
}

app.post('/api/agents/run', async (req, res) => {
  const tenantId = req.user.organizationId;
  const workflow = getWorkflowForTenant(tenantId);
  const runtime = new EchosRuntime(workflow, builtInAgents);
  
  const result = await runtime.run({
    task: req.body.task,
    memory: req.body.memory
  });

  res.json(result);
});
```

---

## Production Checklist

### Security

- [ ] Use environment variables for secrets, never hardcode
- [ ] Enable HTTPS/TLS in production
- [ ] Restrict CORS origins to your domains
- [ ] Review and configure guardrails in `workflow.yaml`
- [ ] Disable code execution unless absolutely needed
- [ ] Use private subnets in K8s/cloud
- [ ] Implement rate limiting

---

### Reliability

- [ ] Set up health checks (`/health` endpoint)
- [ ] Configure retries in workflow policies
- [ ] Set appropriate `maxCost` and `maxDurationMs` limits
- [ ] Monitor trace failures and adjust guardrails
- [ ] Set up alerting for errors
- [ ] Configure resource limits (CPU/memory)
- [ ] Enable auto-scaling (K8s HPA)

---

### Observability

- [ ] Stream logs to centralized logging (DataDog, CloudWatch)
- [ ] Export traces to observability platform
- [ ] Set up dashboards for key metrics:
  - Workflow runs per minute
  - Success/failure rate
  - Average execution time
  - Cost per workflow
- [ ] Configure alerts for:
  - High error rate
  - Cost spikes
  - Slow workflows

---

### Performance

- [ ] Cache LLM responses where appropriate
- [ ] Use connection pooling for databases
- [ ] Consider running multiple runtime instances
- [ ] Optimize workflow configs (reduce unnecessary loops)
- [ ] Use faster LLM models for simple tasks
- [ ] Monitor memory usage and adjust limits

---

### Cost Management

- [ ] Set conservative `maxCost` limits
- [ ] Monitor LLM token usage
- [ ] Use cheaper models where possible (gpt-3.5-turbo vs gpt-4)
- [ ] Implement caching for repeated queries
- [ ] Review and optimize agent prompts
- [ ] Set up billing alerts

---

## Troubleshooting

### "No LLM API key configured"

Add your API key to environment:

```bash
export OPENAI_API_KEY=sk-your-key
```

Or in code:

```typescript
const runtime = new EchosRuntime(workflow, builtInAgents, {
  llm: {
    apiKey: 'sk-your-key'
  }
});
```

---

### "Database not configured"

Echos will use mock data if no database is configured. To connect a real database:

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

---

### "Guardrail violation"

Check the trace to see which guardrail was triggered:

```typescript
const result = await runtime.run({ task });
console.log(result.trace); // See which guardrail failed
```

Then update `workflow.yaml`:

```yaml
agents:
  - name: db_agent
    policy:
      guardrails:
        allowedOperations: [SELECT, INSERT]  # Add missing operation
        allowedTables: [users, orders]       # Add missing table
```

---

### "Cost exceeded"

Increase the cost limit in `workflow.yaml`:

```yaml
limits:
  maxCost: 5.00  # Increase from default 1.00
```

Or per-request:

```typescript
const runtime = new EchosRuntime(workflow, builtInAgents, {
  limits: { maxCost: 10.00 }
});
```

---

## Next Steps

1. **Try the examples:** Check `/examples` folder for complete working apps
2. **Read the API docs:** See `API_REFERENCE.md` for full API details
3. **Join the community:** GitHub Discussions for questions
4. **Deploy to production:** See `DEPLOYMENT.md` for cloud-specific guides

---

## Support

- **Documentation:** https://docs.echos.ai
- **GitHub Issues:** https://github.com/treadiehq/echos/issues
- **Community:** GitHub Discussions
- **Enterprise Support:** contact@echos.ai

