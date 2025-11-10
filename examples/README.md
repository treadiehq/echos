# Workflow Examples

Pre-configured workflow templates for common use cases. Copy these to your project root and customize!

## 🚀 Quick Start

```bash
# 1. Choose a template
cp examples/database-query.yaml workflow.yaml

# 2. Customize it (optional)
# Edit workflow.yaml to add your tables, domains, etc.

# 3. Run it!
npm run run -- "Your task here"
```

## 📋 Available Templates

### 1. 🗄️ Database Query & Analysis
**File:** `database-query.yaml`  
**Use Case:** Query databases and analyze results with AI  
**Perfect For:** Analytics, reporting, data exploration

**What it includes:**
- ✅ Database agent with SQL guardrails
- ✅ Data analysis agent for insights
- ✅ Safe query execution (SELECT, INSERT, UPDATE only)
- ✅ Table whitelisting
- ✅ Automatic retry on failures

**Try it:**
```bash
cp examples/database-query.yaml workflow.yaml
npm run run -- "Get all orders from last month and summarize by category"
```

---

### 2. 🔍 Web Research & Summarization
**File:** `web-research.yaml`  
**Use Case:** Search the web and create comprehensive reports  
**Perfect For:** Market research, competitive analysis, news monitoring

**What it includes:**
- ✅ Search agent (Serper/Brave integration)
- ✅ Data analysis agent for summarization
- ✅ Multi-source research capability
- ✅ Longer timeouts for web requests

**Try it:**
```bash
cp examples/web-research.yaml workflow.yaml
npm run run -- "Research the latest AI agent frameworks and compare features"
```

**Requirements:** `SERPER_API_KEY` or `BRAVE_API_KEY` in `.env`

---

### 3. 🔌 API Integration & Data Processing
**File:** `api-integration.yaml`  
**Use Case:** Fetch data from external APIs and process it  
**Perfect For:** Third-party integrations, data pipelines, webhooks

**What it includes:**
- ✅ API agent with domain whitelisting
- ✅ SSRF protection (blocks private IPs)
- ✅ Data processing and transformation
- ✅ Robust retry logic for flaky APIs

**Try it:**
```bash
cp examples/api-integration.yaml workflow.yaml

# Then use programmatically:
const result = await runtime.run({
  task: "Fetch and analyze",
  memory: { 
    url: "https://api.github.com/repos/vercel/next.js",
    method: "GET"
  }
});
```

---

### 4. 💻 Code Generation
**File:** `code-generation.yaml`  
**Use Case:** Generate code snippets and scripts  
**Perfect For:** Automation, prototyping, code templates

**What it includes:**
- ✅ Code generation agent (multi-language)
- ✅ Optional code review/explanation
- ✅ Code execution DISABLED by default (security)

**Try it:**
```bash
cp examples/code-generation.yaml workflow.yaml
npm run run -- "Generate a TypeScript function to validate email addresses"
```

---

## 🎨 Customization Guide

### Step 1: Choose Your Agents

Each template includes only the agents needed for that use case:

```yaml
agents:
  - name: orchestrator    # Routes tasks (always included)
  - name: db_agent       # Database queries
  - name: search_agent   # Web searches
  - name: api_agent      # API calls
  - name: data_agent     # Analysis & summaries
  - name: code_agent     # Code generation
```

### Step 2: Configure Guardrails

Customize security rules for your use case:

```yaml
# Database Agent
guardrails:
  allowedOperations: [SELECT, INSERT, UPDATE]  # Your allowed SQL operations
  allowedTables: [users, orders]               # Your tables
  requireWhere: true                           # Prevent full table operations

# API Agent
guardrails:
  allowedDomains: [api.github.com]            # Your allowed APIs
  allowedMethods: [GET, POST]                 # Your allowed methods
  blockPrivateIPs: true                       # SSRF protection
```

### Step 3: Set Limits

Control costs and execution time:

```yaml
limits:
  maxDurationMs: 30000   # 30 seconds max
  maxCost: 5.0          # $5 max per workflow
```

### Step 4: Add Memory Context

Pre-seed your workflow with context:

```yaml
memory:
  global:
    environment: "production"
    database_type: "postgresql"
    company_name: "Acme Inc"
```

---

## 🔗 Combining Templates

You can mix and match agents from different templates:

```yaml
# Hybrid: Database + Web Research + Analysis
agents:
  - orchestrator
  - db_agent      # From database-query.yaml
  - search_agent  # From web-research.yaml
  - data_agent    # Common to all

routes:
  orchestrator:
    canCall: [db_agent, search_agent, data_agent]
```

**Example task:**
```bash
npm run run -- "Query our sales database, search for competitor pricing online, and create a competitive analysis report"
```

---

## 💡 Pro Tips

### 1. Start Simple
Copy one template and get it working before customizing.

### 2. Test Guardrails
Try breaking them to make sure they work:
```bash
# This SHOULD fail (good!)
npm run run -- "DELETE FROM users"
```

### 3. Monitor Costs
Check the trace to see LLM costs:
```bash
cat traces/<task-id>.json | grep '"cost"'
```

### 4. Adjust Loop Limits
- Low loops (2-3): Fast, cheaper, less smart
- High loops (5-7): Slower, costlier, smarter

### 5. Use Memory for Context
Pre-load frequently used info:
```yaml
memory:
  global:
    api_keys_location: "AWS Secrets Manager"
    default_user_id: "system"
```

---

## 🐛 Troubleshooting

### "No SQL query found"
Your prompt needs explicit SQL or natural language about database operations.

**Bad:** "Analyze the data"  
**Good:** "Query the users table and analyze signup trends"

### "Domain not allowed"
Add your API domain to `allowedDomains`:
```yaml
allowedDomains:
  - api.yourservice.com
```

### "Cost ceiling exceeded"
Increase per-agent cost limit:
```yaml
guardrails:
  maxCostPerInvocation: 2.0  # Increase from 1.0
```

---

## 📚 Next Steps

1. **Try a template** - Copy and run one
2. **Customize it** - Add your tables, APIs, rules
3. **Build your own** - Mix templates for your use case
4. **Share it** - Submit your workflow as a PR!

Need help? Check the main [README](../README.md) or open an issue.

---

## 🎯 Real-World Use Cases

### SaaS Analytics Dashboard
```bash
cp examples/database-query.yaml workflow.yaml
# Query user metrics, calculate MRR, generate reports
```

### Competitive Intelligence
```bash
cp examples/web-research.yaml workflow.yaml
# Monitor competitors, track pricing, analyze features
```

### API Data Pipeline
```bash
cp examples/api-integration.yaml workflow.yaml
# Fetch from Stripe, GitHub, Slack - transform and store
```

### Code Generation Service
```bash
cp examples/code-generation.yaml workflow.yaml
# Generate API endpoints, database schemas, test code
```

