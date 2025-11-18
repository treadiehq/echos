# AWS Bedrock Setup & Testing Guide

This guide will help you set up and test AWS Bedrock integration with Echos.

## Prerequisites

Before you begin, ensure you have:

1. ✅ AWS Account with Bedrock access
2. ✅ AWS credentials configured (one of the following):
   - IAM role (recommended for ECS/EKS)
   - AWS CLI configured (`aws configure`)
   - Environment variables (access key + secret key)
3. ✅ Model access granted in AWS Bedrock console

## Step 1: Request Model Access

If you haven't already, request access to models in the AWS Bedrock console:

1. Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess
2. Click "Manage model access"
3. Enable access for:
   - Anthropic Claude 3 Sonnet (recommended)
   - Amazon Titan (optional)
   - Other models as needed
4. Submit and wait for approval (usually instant)

## Step 2: Configure AWS Credentials

### Option A: Use IAM Role (Recommended for Production)

If running on AWS infrastructure (ECS, EKS, EC2):

```bash
# No credentials needed - uses the instance/task role
# Just set the LLM provider config
export LLM_PROVIDER=bedrock
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
```

Required IAM policy (attach to your role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-*"
      ]
    }
  ]
}
```

### Option B: Use AWS CLI Credentials

```bash
# Configure AWS CLI (one-time setup)
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter default output format (json)

# Set Bedrock config
export LLM_PROVIDER=bedrock
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
```

### Option C: Use Environment Variables

```bash
export LLM_PROVIDER=bedrock
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

## Step 3: Test the Integration

Run the test script:

```bash
node test-bedrock.mjs
```

### Expected Output

```
🧪 Testing AWS Bedrock Integration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 1: Checking Environment Variables

Required:
  ✅ LLM_PROVIDER: bedrock
  ✅ BEDROCK_REGION: us-east-1
  ✅ BEDROCK_MODEL: anthropic.claude-3-sonnet-20240229-v1:0

Optional (for explicit credentials):
  ⚠️  AWS_ACCESS_KEY_ID: ✗ Not set (will use IAM role)
  ⚠️  AWS_SECRET_ACCESS_KEY: ✗ Not set (will use IAM role)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 2: Loading Configuration

✅ Configuration loaded successfully
   Provider: bedrock
   Region: us-east-1
   Model: anthropic.claude-3-sonnet-20240229-v1:0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 3: Creating Bedrock Client

✅ Bedrock client created successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 4: Testing Bedrock API Call

Sending test message to Bedrock...

✅ Bedrock API call successful!

Response from Bedrock:
────────────────────────────────────────────────────────────
[Claude's response will appear here]
────────────────────────────────────────────────────────────

📊 Metadata:
   Duration: 1234ms
   Provider: bedrock
   Model: anthropic.claude-3-sonnet-20240229-v1:0
   Tokens (prompt): 25
   Tokens (completion): 42
   Tokens (total): 67
   Estimated cost: $0.000201

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 All Tests Passed! Bedrock Integration is Working!
```

## Step 4: Run Your First Workflow

### Quick Test

```bash
npx echos "Hello, please confirm you're running on AWS Bedrock"
```

### Use Bedrock Example Template

```bash
# Copy the Bedrock template
cp examples/aws-bedrock.yaml workflow.yaml

# Set your database URL (if using db_agent)
export DATABASE_URL=postgresql://user:password@host:5432/dbname

# Run a task
npx echos "Query the database for user statistics and analyze trends"
```

### Use in Your Application

```javascript
import { EchosRuntime } from '@echoshq/runtime';

// Configure runtime
const runtime = new EchosRuntime({
  apiKey: process.env.ECHOS_API_KEY,
  apiUrl: 'http://localhost:4000',
  workflow: './workflow.yaml'  // Uses Bedrock via env vars
});

// Run tasks - all LLM calls go to Bedrock
const result = await runtime.run({
  task: 'Analyze customer data and create a report',
  memory: { region: 'us-west', year: 2024 }
});

console.log('Result:', result);
```

## Supported Bedrock Models

Echos works with all Bedrock foundation models:

### Anthropic Claude (Recommended)
- `anthropic.claude-3-sonnet-20240229-v1:0` - Best balance of speed/quality
- `anthropic.claude-3-haiku-20240307-v1:0` - Fastest, most cost-effective
- `anthropic.claude-v2` - Legacy Claude model

### Amazon Titan
- `amazon.titan-text-express-v1` - Fast general-purpose
- `amazon.titan-text-lite-v1` - Lightweight

### Meta Llama
- `meta.llama3-8b-instruct-v1:0` - Open source alternative
- `meta.llama2-70b-chat-v1` - Larger model

### Cohere
- `cohere.command-text-v14` - Enterprise-focused
- `cohere.command-light-text-v14` - Lightweight

## Troubleshooting

### Error: "AccessDenied"

**Problem:** IAM permissions missing

**Solution:** Attach the IAM policy shown above to your IAM user/role

### Error: "ValidationException"

**Problem:** Model not available or incorrect model ID

**Solution:** 
1. Check model access in AWS Bedrock console
2. Verify model ID is correct for your region
3. Request model access if needed

### Error: "UnrecognizedClientException"

**Problem:** AWS credentials invalid or expired

**Solution:**
1. Run `aws configure` to reconfigure CLI
2. Check environment variables are set correctly
3. Verify IAM user has programmatic access enabled

### Error: "ResourceNotFoundException"

**Problem:** Model not found

**Solution:**
1. Go to AWS Bedrock console → Model access
2. Request access to the model
3. Wait for approval (usually instant)

### High Costs

**Problem:** Concerned about costs

**Solution:**
- Set cost limits in `workflow.yaml`:
  ```yaml
  limits:
    maxCost: 1.0  # Maximum $1 per workflow
  
  agents:
    - name: orchestrator
      policy:
        guardrails:
          maxCostPerInvocation: 0.50  # Max $0.50 per agent call
  ```
- Use cost-effective models like Claude Haiku or Titan Lite
- Monitor costs in traces at http://localhost:3000

## Production Deployment

### Deploy to AWS ECS

```json
{
  "taskRoleArn": "arn:aws:iam::123456789012:role/EchosBedrockRole",
  "containerDefinitions": [{
    "name": "echos",
    "image": "your-echos-image",
    "environment": [
      { "name": "LLM_PROVIDER", "value": "bedrock" },
      { "name": "BEDROCK_REGION", "value": "us-east-1" },
      { "name": "BEDROCK_MODEL", "value": "anthropic.claude-3-sonnet-20240229-v1:0" },
      { "name": "DATABASE_URL", "value": "postgresql://..." }
    ]
  }]
}
```

### Benefits of Bedrock on AWS

- ✅ **Compliance**: All data stays in your AWS account
- ✅ **VPC Isolation**: Run Bedrock endpoints in your VPC
- ✅ **Cost Control**: AWS billing integration
- ✅ **IAM Integration**: Use existing roles and policies
- ✅ **No API Keys**: No external API keys to manage

## Need Help?

- 📚 [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- 💬 [Join our Discord](https://discord.gg/KqdBcqRk5E)
- 🐛 [Report Issues](https://github.com/treadiehq/echos/issues)

## Next Steps

1. ✅ Test basic Bedrock integration (`node test-bedrock.mjs`)
2. ✅ Try different models (Titan, Llama, etc.)
3. ✅ Set up production deployment to ECS/EKS
4. ✅ Configure cost limits and monitoring
5. ✅ Build your multi-agent workflows!

