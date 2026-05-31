#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║            Code Judge API — Integration Test Script         ║
# ║                                                              ║
# ║  Tests all 12 API endpoints with expected responses.         ║
# ║  Usage: bash test/api-test.sh                                ║
# ║  Requires: curl, python3                                     ║
# ╚══════════════════════════════════════════════════════════════╝

BASE_URL="http://localhost:4100/api/v1"
PASS=0
FAIL=0
TOTAL=0

sha256() {
  python3 -c "import hashlib,sys; print(hashlib.sha256(sys.argv[1].encode()).hexdigest())" "$1"
}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

assert_status() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $desc (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_json_field() {
  local desc="$1"
  local json="$2"
  local field="$3"
  local expected="$4"
  TOTAL=$((TOTAL + 1))
  local actual=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','__MISSING__'))" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $desc ($field=$actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc ($field: expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

# ════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Code Judge API Integration Tests${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}\n"

# ─── 1. Health Check ───────────────────────────────────────────
echo -e "${YELLOW}▸ Health Check${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
assert_status "GET /health returns 200" "200" "$HEALTH_STATUS"
HEALTH_BODY=$(curl -s "$BASE_URL/health")
assert_json_field "status is UP" "$HEALTH_BODY" "status" "UP"

# ─── 2. Auth — Signup ─────────────────────────────────────────
echo -e "\n${YELLOW}▸ Authentication — Signup${NC}"
TESTPASS_SHA=$(sha256 "testpass123")
SIGNUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser_$$\",\"email\":\"test_$$@example.com\",\"passwordSha256\":\"$TESTPASS_SHA\"}")
assert_status "POST /auth/signup returns 201" "201" "$SIGNUP_STATUS"

# ─── 3. Auth — Login ──────────────────────────────────────────
echo -e "\n${YELLOW}▸ Authentication — Login${NC}"
ADMINPASS_SHA=$(sha256 "admin123")
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"passwordSha256\":\"$ADMINPASS_SHA\"}")
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"passwordSha256\":\"$ADMINPASS_SHA\"}")
assert_status "POST /auth/login returns 200" "200" "$LOGIN_STATUS"
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ -n "$TOKEN" ] && [ "$TOKEN" != "None" ]; then
  echo -e "  ${GREEN}✓${NC} JWT token received (${TOKEN:0:30}...)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} No JWT token in response"
  FAIL=$((FAIL + 1))
fi

# Login with wrong password
WRONGPASS_SHA=$(sha256 "wrong")
BAD_LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"passwordSha256\":\"$WRONGPASS_SHA\"}")
assert_status "POST /auth/login with wrong password returns 401" "401" "$BAD_LOGIN_STATUS"

# ─── 4. Problems — List ───────────────────────────────────────
echo -e "\n${YELLOW}▸ Problems — List${NC}"
PROBLEMS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/problems")
assert_status "GET /problems returns 200" "200" "$PROBLEMS_STATUS"
PROBLEMS_BODY=$(curl -s "$BASE_URL/problems")
PROBLEM_COUNT=$(echo "$PROBLEMS_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
PROBLEM_ID=$(echo "$PROBLEMS_BODY" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['problem_id'])" 2>/dev/null)
PROBLEM_TITLE=$(echo "$PROBLEMS_BODY" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[0]['title'])" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$PROBLEM_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Found $PROBLEM_COUNT problems"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} No problems found"
  FAIL=$((FAIL + 1))
fi

# Filter by difficulty
EASY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/problems?difficulty=EASY")
assert_status "GET /problems?difficulty=EASY returns 200" "200" "$EASY_STATUS"

# ─── 5. Problems — Detail ─────────────────────────────────────
echo -e "\n${YELLOW}▸ Problems — Detail${NC}"
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/problems/$PROBLEM_ID")
assert_status "GET /problems/:id returns 200" "200" "$DETAIL_STATUS"
DETAIL_BODY=$(curl -s "$BASE_URL/problems/$PROBLEM_ID")
assert_json_field "problem title matches list" "$DETAIL_BODY" "title" "$PROBLEM_TITLE"

NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/problems/99999")
assert_status "GET /problems/99999 returns 404" "404" "$NOT_FOUND_STATUS"

# ─── 6. Problems — Create (Admin) ─────────────────────────────
echo -e "\n${YELLOW}▸ Problems — Create (Admin)${NC}"
CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/problems" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"API Test Problem","description":"Created by test","difficulty":"EASY","test_cases":[{"input":"1","output":"1"}]}')
assert_status "POST /problems (Admin) returns 201" "201" "$CREATE_STATUS"

# Without auth
NO_AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/problems" \
  -H "Content-Type: application/json" \
  -d '{"title":"Unauthorized","description":"Test","difficulty":"EASY","test_cases":[{"input":"1","output":"1"}]}')
assert_status "POST /problems without auth returns 401" "401" "$NO_AUTH_STATUS"

# ─── 7. Problems — Assign ─────────────────────────────────────
echo -e "\n${YELLOW}▸ Problems — Assign${NC}"
ASSIGN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/problems/$PROBLEM_ID/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"assignee_username":"bob"}')
assert_status "POST /problems/:id/assign returns 200" "200" "$ASSIGN_STATUS"

# ─── 8. Submissions — Submit ──────────────────────────────────
echo -e "\n${YELLOW}▸ Submissions — Submit Code${NC}"
# Login as alice for submission
ALICEPASS_SHA=$(sha256 "user123")
ALICE_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"passwordSha256\":\"$ALICEPASS_SHA\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/submissions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d "{\"problem_id\":$PROBLEM_ID,\"language\":\"python3\",\"source_code\":\"def twoSum(nums, target): pass\"}")
SUBMIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/submissions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d "{\"problem_id\":$PROBLEM_ID,\"language\":\"python3\",\"source_code\":\"def twoSum(nums, target): pass\"}")
assert_status "POST /submissions returns 202" "202" "$SUBMIT_STATUS"

SUB_ID=$(echo "$SUBMIT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['submission_id'])" 2>/dev/null)
assert_json_field "initial status is PENDING" "$SUBMIT_RESPONSE" "status" "PENDING"

# ─── 9. Submissions — Poll Result ─────────────────────────────
echo -e "\n${YELLOW}▸ Submissions — Poll Result${NC}"
echo -e "  ⏳ Waiting 4s for judging..."
sleep 4
POLL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/submissions/$SUB_ID")
assert_status "GET /submissions/:id returns 200" "200" "$POLL_STATUS"
POLL_BODY=$(curl -s "$BASE_URL/submissions/$SUB_ID")
FINAL_STATUS=$(echo "$POLL_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$FINAL_STATUS" != "PENDING" ] && [ "$FINAL_STATUS" != "COMPILING" ] && [ "$FINAL_STATUS" != "RUNNING" ]; then
  echo -e "  ${GREEN}✓${NC} Submission judged: $FINAL_STATUS"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Submission still pending: $FINAL_STATUS"
  FAIL=$((FAIL + 1))
fi

# ─── 10. Users — Submission History ───────────────────────────
echo -e "\n${YELLOW}▸ Users — Submission History${NC}"
HISTORY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/users/alice/submissions")
assert_status "GET /users/alice/submissions returns 200" "200" "$HISTORY_STATUS"

USER_404_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/users/nonexistent/submissions")
assert_status "GET /users/nonexistent/submissions returns 404" "404" "$USER_404_STATUS"

# ─── 11. Leaderboard ──────────────────────────────────────────
echo -e "\n${YELLOW}▸ Leaderboard${NC}"
LB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/leaderboard")
assert_status "GET /leaderboard returns 200" "200" "$LB_STATUS"
LB_BODY=$(curl -s "$BASE_URL/leaderboard")
RANK1=$(echo "$LB_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['rank'])" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if [ "$RANK1" = "1" ]; then
  echo -e "  ${GREEN}✓${NC} First rank is 1"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} First rank is $RANK1"
  FAIL=$((FAIL + 1))
fi

# ─── 12. Internal — Test Cases ─────────────────────────────────
echo -e "\n${YELLOW}▸ Internal — Test Cases${NC}"
INTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-internal-api-key: internal-judge-worker-key-change-in-production" \
  "$BASE_URL/internal/testcases/$PROBLEM_ID")
assert_status "GET /internal/testcases/:id (with key) returns 200" "200" "$INTERNAL_STATUS"

NO_KEY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/internal/testcases/$PROBLEM_ID")
assert_status "GET /internal/testcases/:id (no key) returns 401" "401" "$NO_KEY_STATUS"

# ─── 13. Problems — Delete (Admin) ────────────────────────────
echo -e "\n${YELLOW}▸ Problems — Delete (Admin)${NC}"
# Get last created problem ID
LAST_ID=$(curl -s "$BASE_URL/problems" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(items[-1]['problem_id'])" 2>/dev/null)
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/problems/$LAST_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_status "DELETE /problems/:id returns 204" "204" "$DELETE_STATUS"

# ─── 14. Interviews & Candidates ─────────────────────────────────
echo -e "\n${YELLOW}▸ Interviews & Candidates${NC}"
ADMIN_ID=$(curl -s "$BASE_URL/users" | python3 -c "import sys,json; users=json.load(sys.stdin)['data']; print([u['id'] for u in users if u['username']=='admin'][0])" 2>/dev/null)
INTERVIEW_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/interviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"jobRole\":\"Frontend Developer\", \"examinerEmpId\":\"$ADMIN_ID\"}")
INTERVIEW_RESPONSE=$(echo "$INTERVIEW_RESULT" | sed '$d')
INTERVIEW_STATUS=$(echo "$INTERVIEW_RESULT" | tail -n 1)
assert_status "POST /interviews returns 201" "201" "$INTERVIEW_STATUS"

INTERVIEW_ID=$(echo "$INTERVIEW_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

UPDATE_INTERVIEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/interviews/$INTERVIEW_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jobRole":"Senior Frontend Developer"}')
assert_status "PATCH /interviews/:id returns 200" "200" "$UPDATE_INTERVIEW_STATUS"

# Add candidate
ALICE_ID=$(curl -s "$BASE_URL/users" | python3 -c "import sys,json; users=json.load(sys.stdin)['data']; print([u['id'] for u in users if u['username']=='alice'][0])" 2>/dev/null)
CANDIDATE_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/interview-candidates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"jobId\":$INTERVIEW_ID, \"userId\":\"$ALICE_ID\"}")
CANDIDATE_RESPONSE=$(echo "$CANDIDATE_RESULT" | sed '$d')
CANDIDATE_STATUS=$(echo "$CANDIDATE_RESULT" | tail -n 1)
assert_status "POST /interview-candidates returns 201" "201" "$CANDIDATE_STATUS"

CANDIDATE_ID=$(echo "$CANDIDATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

UPDATE_CANDIDATE_TIME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/interview-candidates/$CANDIDATE_ID/time" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"startTime":1770000000,"endTime":1770003600}')
assert_status "PATCH /interview-candidates/:id/time returns 200" "200" "$UPDATE_CANDIDATE_TIME_STATUS"

# Delete candidate
DEL_CANDIDATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/interview-candidates/$CANDIDATE_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_status "DELETE /interview-candidates/:id returns 204" "204" "$DEL_CANDIDATE_STATUS"

# Delete interview
DEL_INTERVIEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/interviews/$INTERVIEW_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_status "DELETE /interviews/:id returns 204" "204" "$DEL_INTERVIEW_STATUS"

# ═══════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo -e "${CYAN}═══════════════════════════════════════${NC}\n"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
