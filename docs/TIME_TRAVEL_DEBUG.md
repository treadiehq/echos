# Time-Travel Debugging for Echos

## Overview

Time-travel debugging is Echos' game-changing feature that lets you **replay failed agent runs with modified configurations** using the exact same context. No more blind debugging - see exactly what would have happened with your fixes before deploying to production.

## The Problem It Solves

When an AI agent fails in production:
1. ❌ Logs are useless - just show the wrong output
2. ❌ Can't reproduce locally - data/state is different
3. ❌ Modify prompts/config blindly
4. ❌ Deploy and hope it works
5. ❌ Wait for it to fail again
6. ❌ Repeat 10x (costing time + money)

## The Solution

With Time-Travel Debugging:
1. ✅ Agent fails → Click the trace
2. ✅ Click "Time Travel Debug" button
3. ✅ See the EXACT context (task, memory, workflow config)
4. ✅ Edit the workflow config right there
5. ✅ Click "Test This Fix" → See what would have happened
6. ✅ See the diff: Original (❌ error) → With Fix (✅ ok)
7. ✅ Click "Deploy Fix" → Done!

**You just fixed 47 production failures in 5 minutes.**

---

## How It Works

### 1. Trace Storage
Every workflow execution now stores:
- **Workflow Configuration** - The exact YAML config used
- **Initial Task** - The original task/message
- **Initial Memory** - The input payload/context

This data is captured in `src/lib/trace.ts` and stored with each trace.

### 2. Replay Engine
The `EchosRuntime` has a `replay()` method that:
- Takes an original trace
- Accepts modified workflow configuration
- Re-executes with **original inputs** but **new config**
- Returns a new trace showing what would happen

### 3. API Endpoint
**POST** `/traces/:id/replay`

```json
{
  "workflowConfig": {
    "agents": [...],
    "routes": {...},
    "limits": {...}
  }
}
```

Returns the new execution result.

### 4. Frontend Modal
The `TimeTravelDebugModal.vue` component provides:
- YAML editor with syntax validation
- Real-time YAML parsing
- Test button to replay with changes
- Side-by-side comparison of results
- Deploy button to update workflow
- Diff view showing improvements

---

## Usage

### Step 1: Find a Failed Trace

1. Go to your Echos dashboard at `http://localhost:3000`
2. Click on a trace with status **error** or **stopped**
3. You'll see the failed execution details

### Step 2: Open Time-Travel Debug

Click the **"Time Travel Debug"** button (it glows blue on failed traces!)

### Step 3: Edit the Configuration

The modal shows:
- **Original Context** - The task and memory from the failed run
- **Workflow Config** - Editable YAML with syntax validation

Modify whatever you want:
- Change agent prompts
- Adjust retry counts
- Modify guardrails
- Change routing
- Update cost limits

### Step 4: Test Your Fix

Click **"Test This Fix"** button.

Echos will:
1. Parse your modified YAML
2. Replay the workflow with original data
3. Show you the results in real-time
4. Create a new trace you can inspect

### Step 5: Compare Results

The "Test Result" tab shows:
- **Original Status** → **New Status**
- Cost comparison
- Duration comparison
- Full result payload
- Link to the new trace

If it shows **"Fixed! ✅"** you're golden!

### Step 6: Deploy the Fix

Click **"Deploy This Fix"** to:
- Update the workflow configuration
- Apply changes to production
- All future runs use the new config

---

## Example Workflow

Let's say your API agent failed because it hit a retry limit:

```yaml
# Original Config (Failed)
agents:
  - name: api_agent
    type: worker
    maxLoops: 1
    policy:
      retries:
        count: 2  # Too few!
        backoffMs: 1000
```

**Time-Travel Debug:**
1. Open the failed trace
2. Click "Time Travel Debug"
3. Change `count: 2` to `count: 5`
4. Click "Test This Fix"
5. See it now succeeds! ✅
6. Click "Deploy This Fix"

**Result:** Same failure will never happen again. You fixed it in 60 seconds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Clicks Failed Trace                 │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   TimeTravelDebugModal.vue                   │
│  • Shows original context (task + memory)                    │
│  • YAML editor for workflow config                           │
│  • "Test This Fix" button                                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼ POST /traces/:id/replay
┌─────────────────────────────────────────────────────────────┐
│              server/src/traces/traces.service.ts             │
│  • Fetches original trace                                    │
│  • Validates modified config                                 │
│  • Calls EchosRuntime.replay()                               │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   src/runtime.ts - replay()                  │
│  • Extracts original task + memory                           │
│  • Temporarily swaps workflow config                         │
│  • Runs workflow with new config                             │
│  • Returns result with isReplay=true flag                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              New trace created → Show comparison             │
│  Original: ❌ error → With Fix: ✅ ok                        │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Click "Deploy This Fix"                      │
│  • Updates workflow via PATCH /workflow/:id                  │
│  • All future runs use new config                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Modified Files

**Runtime (Core)**
- `src/lib/trace.ts` - Added `workflowConfig`, `initialTask`, `initialMemory` to traces
- `src/runtime.ts` - Store config with traces, added `replay()` method

**Backend (API)**
- `server/src/traces/traces.controller.ts` - Added `POST /:id/replay` endpoint
- `server/src/traces/traces.service.ts` - Added `replayTrace()` method

**Frontend (UI)**
- `web/components/TimeTravelDebugModal.vue` - NEW: Full modal component
- `web/pages/index.vue` - Integrated modal, added "Time Travel Debug" button
- `web/package.json` - Added `yaml` dependency

### Data Flow

```typescript
// 1. Normal Execution - Store snapshot
const trace = new TraceStore(
  taskId,
  ceilings,
  memoryNamespaces,
  workflowConfig,  // ← NEW
  task,            // ← NEW
  memory           // ← NEW
);

// 2. Replay with modified config
const result = await runtime.replay(
  originalTrace,
  modifiedWorkflowConfig
);

// 3. Compare results
if (result.status === 'ok' && originalTrace.status === 'error') {
  // Fixed! 🎉
}
```

---

## Benefits

### For Developers
- **Debug 10x faster** - See exactly what would happen with your fixes
- **No guessing** - Test before deploying
- **Learn quickly** - See cause and effect in real-time
- **Save money** - Stop wasting tokens on failed attempts

### For Companies
- **Reduce downtime** - Fix production issues in minutes, not hours
- **Lower costs** - Less failed LLM calls
- **Better reliability** - Test fixes before deploying
- **Audit trail** - See exactly what changed and why

### For Users
- **Better experience** - Fewer errors in production
- **Faster fixes** - Issues resolved immediately
- **More reliable** - Tested fixes, not blind changes

---

## Limitations & Future Improvements

### Current Limitations
1. **No DB state replay** - Can't replay database state (yet)
2. **No API replay** - External API calls still hit real endpoints
3. **No date/time travel** - Time-dependent operations use current time

### Roadmap
- [ ] Capture and replay HTTP responses
- [ ] Snapshot database state for full replay
- [ ] A/B test multiple config changes
- [ ] Batch fix multiple failed traces
- [ ] AI-suggested fixes based on error patterns
- [ ] Replay with different input data

---

## FAQ

**Q: Does replay use real LLM calls?**  
A: Yes, replay makes real API calls to OpenAI/Anthropic. You'll be charged for tokens.

**Q: Can I replay successful traces?**  
A: Yes! Use it to test optimizations (lower costs, faster execution, better prompts).

**Q: What if I don't have a workflow ID?**  
A: Old traces or CLI runs without workflows can't be deployed, but you can still test changes.

**Q: Can I replay with different input data?**  
A: Not yet - replay uses the original task and memory. This is on the roadmap!

**Q: Does this work with custom agents?**  
A: Yes! It works with any workflow configuration.

---

## Demo Video (Coming Soon)

Watch a 2-minute demo showing:
1. Failed API call trace
2. Opening Time-Travel Debug
3. Fixing the config
4. Testing the fix
5. Deploying to production

**Result: 47 failures fixed in 5 minutes.**

---

## Support

Having issues? Found a bug?

1. Check the browser console for errors
2. Check server logs: `docker logs echos-api`
3. Open an issue on GitHub
4. Join our Discord: https://discord.gg/KqdBcqRk5E

---

## License

Same as Echos: FSL-1.1-MIT

