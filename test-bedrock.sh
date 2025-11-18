#!/bin/bash

# Quick test script for AWS Bedrock integration
# This script helps you quickly test if Bedrock is working

echo "🚀 Quick Bedrock Test Setup"
echo ""

# Check if environment variables are set
if [ -z "$LLM_PROVIDER" ] || [ "$LLM_PROVIDER" != "bedrock" ]; then
    echo "⚠️  LLM_PROVIDER not set to 'bedrock'"
    echo ""
    echo "Setting up environment variables..."
    echo ""
    
    # Set defaults
    export LLM_PROVIDER=bedrock
    export BEDROCK_REGION=${BEDROCK_REGION:-us-east-1}
    export BEDROCK_MODEL=${BEDROCK_MODEL:-anthropic.claude-3-sonnet-20240229-v1:0}
    
    echo "✅ Environment configured:"
    echo "   LLM_PROVIDER=$LLM_PROVIDER"
    echo "   BEDROCK_REGION=$BEDROCK_REGION"
    echo "   BEDROCK_MODEL=$BEDROCK_MODEL"
    echo ""
fi

# Check if AWS credentials are configured
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "ℹ️  No explicit AWS credentials set"
    echo "   Will use default credential chain (IAM role, AWS CLI, etc.)"
    echo ""
fi

# Run the test
echo "Running Bedrock integration test..."
echo ""
node test-bedrock.mjs

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Success! Your Bedrock integration is working."
    echo ""
    echo "Try running a workflow:"
    echo "  npx echos \"Tell me about AWS Bedrock\""
else
    echo ""
    echo "❌ Test failed. Check the error messages above."
    echo ""
    echo "💡 Quick troubleshooting:"
    echo "  1. Verify AWS credentials: aws sts get-caller-identity"
    echo "  2. Check Bedrock access: https://console.aws.amazon.com/bedrock/"
    echo "  3. See full guide: cat BEDROCK-SETUP.md"
fi

exit $exit_code

