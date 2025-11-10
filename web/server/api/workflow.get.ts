import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

export default defineEventHandler(() => {
  try {
    // Read workflow.yaml from the project root (one level up from web/)
    const workflowPath = path.resolve(process.cwd(), '..', 'workflow.yaml');
    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflow = parse(content);
    
    return {
      success: true,
      workflow
    };
  } catch (error) {
    console.error('Error loading workflow.yaml:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load workflow.yaml'
    };
  }
});

