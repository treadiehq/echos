import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

export default defineEventHandler((event) => {
  try {
    const id = getRouterParam(event, 'id');
    const projectRoot = path.resolve(process.cwd(), '..');
    
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
    
    const workflowPath = path.join(projectRoot, relativePath);
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

