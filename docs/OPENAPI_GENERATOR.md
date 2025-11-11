# OpenAPI → Agent Generator

Generate production-ready agents from any OpenAPI spec in seconds.

## Overview

The OpenAPI Generator transforms API specifications into fully-configured Echos workflows with:

- ✅ **Automatic guardrails** - Domain allowlisting, method restrictions, SSRF protection
- ✅ **Smart endpoint discovery** - Parses all endpoints with parameters and schemas
- ✅ **Auth configuration** - Detects Bearer, API Key, OAuth2, and Basic auth
- ✅ **Complete documentation** - Endpoints stored in memory for LLM reference
- ✅ **One-click deployment** - Preview, edit, and save instantly

## Quick Start

### 1. Open the Generator

In the Echos UI, click the **"Generate from OpenAPI"** button in the sidebar.

### 2. Paste Your Spec

You can provide:
- **URL**: `https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json`
- **JSON**: Paste the entire OpenAPI JSON
- **Quick examples**: Try Stripe, GitHub, or Petstore demo

### 3. Configure Options

- **Include data agent**: Add analysis capabilities (recommended)
- **Max cost**: Set spending limits for safety

### 4. Preview & Save

Review the generated workflow, make any customizations, and click **"Save Workflow"**.

## Examples

### Stripe API Agent

```bash
# URL to use:
https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
```

**What you get:**
- 200+ endpoints automatically mapped
- Payment, customer, and subscription operations
- Bearer token auth configured
- Domain restricted to `api.stripe.com`

### GitHub API Agent

```bash
# URL to use:
https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
```

**What you get:**
- Repos, issues, PRs, actions, and more
- OAuth2 auth configured
- Domain restricted to `api.github.com`

### Custom Internal API

Paste your company's OpenAPI spec to create an instant agent for internal tools.

## Generated Workflow Structure

Every generated workflow includes:

### 1. Orchestrator Agent
- Coordinates API calls and data processing
- Reads from global memory (your API spec)
- Writes orchestration state

### 2. API Agent
- Makes HTTP requests to allowed domains only
- Enforces method restrictions (GET, POST, etc.)
- SSRF protection enabled
- Respects retry policies for flaky APIs

### 3. Data Agent (Optional)
- Analyzes API responses
- Generates insights and summaries
- Transforms data formats

### 4. Memory Configuration
- `api_spec`: Full endpoint documentation
- `auth`: Authentication instructions
- Organized by tags/categories

### 5. Guardrails
- **Domain allowlist**: Only approved domains
- **Method allowlist**: Only safe HTTP methods
- **Private IP blocking**: SSRF prevention
- **Cost limits**: Budget protection

## Architecture

```
User Request
    ↓
Orchestrator
    ↓
API Agent → External API (guarded)
    ↓
Data Agent (optional)
    ↓
Structured Response
```

## Security Features

### Domain Allowlisting
Only explicitly allowed domains can be called:
```yaml
guardrails:
  allowedDomains:
    - api.stripe.com
    - api.github.com
```

### Method Restrictions
Prevent destructive operations if needed:
```yaml
guardrails:
  allowedMethods:
    - GET
    - POST
```

### SSRF Protection
Blocks access to private IPs and internal networks:
```yaml
guardrails:
  blockPrivateIPs: true
```

### Cost Limits
Prevent runaway costs:
```yaml
guardrails:
  maxCostPerInvocation: 0.5
limits:
  maxCost: 5.0
```

## API Endpoints

The generator exposes two backend endpoints:

### `POST /openapi/parse`
Parse and validate an OpenAPI spec.

**Request:**
```json
{
  "spec": "https://api.example.com/openapi.json"
}
```

**Response:**
```json
{
  "success": true,
  "api": {
    "title": "Example API",
    "version": "1.0.0",
    "endpointCount": 42,
    "domains": ["api.example.com"],
    "auth": [{ "type": "bearer" }]
  }
}
```

### `POST /openapi/generate`
Generate a workflow from an OpenAPI spec.

**Request:**
```json
{
  "spec": "https://api.example.com/openapi.json",
  "options": {
    "includeDataAgent": true,
    "maxCost": 5.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "workflow": "# YAML workflow content",
  "api": {
    "title": "Example API",
    "endpointCount": 42
  }
}
```

## Customization

After generation, you can edit the workflow to:

1. **Add custom agents** - Search, code execution, database queries
2. **Modify guardrails** - Adjust domains, methods, costs
3. **Configure memory** - Add API keys, default parameters
4. **Adjust routing** - Control agent communication flow
5. **Set rate limits** - Add custom throttling logic

## Use Cases

### Customer Support Automation
Generate agents for:
- Zendesk API → Ticket management
- Intercom API → Live chat automation
- Freshdesk API → Support workflows

### Financial Operations
- Stripe API → Billing and payments
- Plaid API → Bank connections
- QuickBooks API → Accounting automation

### Developer Tools
- GitHub API → CI/CD automation
- Jira API → Project management
- Slack API → Team notifications

### Data Integration
- Salesforce API → CRM sync
- HubSpot API → Marketing automation
- Google Sheets API → Data pipelines

## Best Practices

1. **Start with public examples** - Test with Petstore or GitHub first
2. **Review guardrails** - Ensure domains and methods are appropriate
3. **Add API keys securely** - Use environment variables, not hardcoded values
4. **Test incrementally** - Start with read-only operations (GET)
5. **Monitor costs** - Set conservative limits initially

## Troubleshooting

### "Invalid JSON spec"
- Ensure the spec is valid OpenAPI 3.x or Swagger 2.0
- Try using a URL instead of pasting JSON
- Validate at https://editor.swagger.io

### "Domain not in allowlist"
- Check the generated guardrails
- Add missing domains to `allowedDomains`

### "Failed to parse spec"
- Verify the URL is publicly accessible
- Check for CORS issues
- Ensure the spec is properly formatted

### "Workflow not saving"
- Ensure you're logged in
- Check organization permissions
- Verify YAML syntax is valid

## Roadmap

Future enhancements planned:

- [ ] **Smart grouping** - Separate agents per API tag/category
- [ ] **Schema validation** - Request/response validation from OpenAPI schemas
- [ ] **Rate limit detection** - Auto-configure from `x-ratelimit-*` headers
- [ ] **Cost estimation** - Predict API costs from documentation
- [ ] **Test generation** - Create test cases from `examples`
- [ ] **OAuth2 flow** - Guided authentication setup
- [ ] **Webhook integration** - Two-way API communication
- [ ] **API key management** - Secure credential storage UI

## Contributing

Found a bug or have a feature request? Open an issue on GitHub!

## Learn More

- [Echos Documentation](../README.md)
- [Agent Architecture](../docs/MEMORY.md)
- [Workflow Examples](../examples/)

