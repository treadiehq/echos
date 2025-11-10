import { EchosRuntime, loadWorkflow, builtInAgents } from './dist/index.js'
import 'dotenv/config'

const runtime = new EchosRuntime(
  loadWorkflow('./workflow.yaml'),
  builtInAgents,
  {
    apiKey: process.env.ECHOS_API_KEY,
    apiUrl: process.env.ECHOS_API_URL || 'http://localhost:4000'
  }
)

async function test() {
  console.log('🚀 Running workflow...')
  console.log('')
  
  try {
    const result = await runtime.run({
      task: 'Tell me a programming joke',
      memory: {}
    })
    
    console.log('✅ Success!')
    console.log('📋 Result:', result.result)
    console.log('')
    console.log(`🔗 View trace: http://localhost:3000/?trace=${result.taskId}`)
    console.log(`📊 Org ID: ${result.orgId}`)
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

test()

