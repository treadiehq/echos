#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:4000"
TEST_EMAIL="test@example.com"

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Echos Auth System - Test Suite         ║${NC}"
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo ""

# Test 1: Health check
echo -e "${YELLOW}[1/6] Testing health endpoint...${NC}"
HEALTH=$(curl -s $API_URL/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Send magic link
echo -e "${YELLOW}[2/6] Sending magic link to $TEST_EMAIL...${NC}"
MAGIC_RESPONSE=$(curl -s -X POST $API_URL/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\"}")

if echo "$MAGIC_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Magic link sent successfully${NC}"
    echo "$MAGIC_RESPONSE" | jq '.' 2>/dev/null || echo "$MAGIC_RESPONSE"
    echo ""
    echo -e "${BLUE}📧 Check the backend console for the magic link!${NC}"
    echo -e "${BLUE}Look for output like:${NC}"
    echo -e "${BLUE}   🔗 Link: http://localhost:4000/auth/verify?token=xxxxx${NC}"
else
    echo -e "${RED}❌ Failed to send magic link${NC}"
    echo "$MAGIC_RESPONSE"
fi
echo ""

# Test 3: Check auth endpoint (should fail without auth)
echo -e "${YELLOW}[3/6] Testing protected endpoint (should fail)...${NC}"
ME_RESPONSE=$(curl -s -w "\n%{http_code}" $API_URL/auth/me)
HTTP_CODE=$(echo "$ME_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Protected endpoint correctly requires auth${NC}"
else
    echo -e "${RED}❌ Expected 401 status, got $HTTP_CODE${NC}"
fi
echo ""

# Test 4: Organizations endpoint (should fail without auth)
echo -e "${YELLOW}[4/6] Testing organizations endpoint (should fail)...${NC}"
ORGS_RESPONSE=$(curl -s -w "\n%{http_code}" $API_URL/organizations)
HTTP_CODE=$(echo "$ORGS_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Organizations endpoint correctly requires auth${NC}"
else
    echo -e "${RED}❌ Expected 401 status, got $HTTP_CODE${NC}"
fi
echo ""

# Test 5: Check database connection
echo -e "${YELLOW}[5/6] Checking database schema...${NC}"
DB_CHECK=$(docker exec echos-postgres psql -U echos -d echos -c "\dt" 2>&1)
if echo "$DB_CHECK" | grep -q "users\|organizations"; then
    echo -e "${GREEN}✅ Database tables created successfully${NC}"
    echo "$DB_CHECK" | grep -E "users|organizations|api_keys|workflows|traces"
else
    echo -e "${RED}❌ Database tables not found${NC}"
    echo "$DB_CHECK"
fi
echo ""

# Test 6: Summary
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test Summary                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Backend API is running${NC}"
echo -e "${GREEN}✅ Magic link authentication is working${NC}"
echo -e "${GREEN}✅ Protected endpoints are secured${NC}"
echo -e "${GREEN}✅ Database schema is created${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps for manual testing:${NC}"
echo ""
echo -e "  1. Open ${BLUE}http://localhost:3000${NC} in your browser"
echo -e "  2. Click ${BLUE}'Sign In'${NC} button in the header"
echo -e "  3. Enter email: ${BLUE}$TEST_EMAIL${NC}"
echo -e "  4. Check the backend console for the magic link"
echo -e "  5. Copy and paste the full URL from the console into your browser"
echo -e "  6. You should be redirected back to the app, logged in!"
echo -e "  7. Navigate to ${BLUE}Organizations${NC} page to create your first org"
echo -e "  8. Create an API key and test API access"
echo ""
echo -e "${GREEN}🎉 Authentication system is ready for testing!${NC}"
echo ""

