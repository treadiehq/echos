import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

export default defineEventHandler((event) => {
  try {
    const id = getRouterParam(event, 'id');
    
    // Map workflow IDs to file paths
    const workflowPaths: Record<string, string> = {
      'main': 'workflow.yaml',
      'api': 'examples/api-integration.yaml',
      'database': 'examples/database-query.yaml',
      'research': 'examples/web-research.yaml',
      'code': 'examples/code-generation.yaml',
    };
    
    const relativePath = workflowPaths[id || 'main'];
    if (!relativePath) {
      return {
        success: false,
        error: 'Unknown workflow ID'
      };
    }
    
    // Try multiple paths:
    // 1. Production: .output/public/workflows (after build)
    // 2. Development: workflows directory in web folder
    // 3. Fallback: parent directory (for backward compatibility)
    let workflowPath = path.join(process.cwd(), '.output/public/workflows', relativePath);
    
    if (!fs.existsSync(workflowPath)) {
      // Try local workflows directory
      workflowPath = path.join(process.cwd(), 'workflows', relativePath);
    }
    
    if (!fs.existsSync(workflowPath)) {
      // Try parent directory (fallback)
      workflowPath = path.join(process.cwd(), '..', relativePath);
    }
    
    // Check if file exists before reading
    if (!fs.existsSync(workflowPath)) {
      return {
        success: false,
        error: 'Workflow file not found. Make sure workflow files are available.'
      };
    }
    
    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflow = parse(content);
    
    return {
      success: true,
      workflow
    };
  } catch (error) {
    console.error('Error loading workflow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load workflow'
    };
  }
});

