import fs from 'fs';
import path from 'path';

function extractWorkflowName(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Look for "# Example: " in first few lines
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      const exampleMatch = line.match(/^#\s*Example:\s*(.+)$/);
      if (exampleMatch) {
        const fullName = exampleMatch[1].trim();
        // Shorten common patterns
        return fullName
          .replace('API Integration & Data Processing', 'API Integration')
          .replace('Database Query & Analysis', 'Database Query')
          .replace('Web Research & Summarization', 'Web Research')
          .replace('AI Code Generation', 'Code Generation')
          .replace('& Data Processing', '')
          .replace('& Analysis', '')
          .replace('& Summarization', '')
          .trim();
      }
    }
    // Fallback to filename
    return path.basename(filePath, '.yaml')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return 'Unknown';
  }
}

export default defineEventHandler(() => {
  try {
    // List of workflow files
    const workflowDefs = [
      { id: 'main', path: 'workflow.yaml' },
      { id: 'api', path: 'examples/api-integration.yaml' },
      { id: 'database', path: 'examples/database-query.yaml' },
      { id: 'research', path: 'examples/web-research.yaml' },
      { id: 'code', path: 'examples/code-generation.yaml' },
    ];
    
    // Filter to only existing files and extract names
    const available = workflowDefs
      .map(w => {
        // Try multiple paths:
        // 1. Production: .output/public/workflows
        // 2. Development: workflows directory in web folder
        // 3. Fallback: parent directory
        let fullPath = path.join(process.cwd(), '.output/public/workflows', w.path);
        
        if (!fs.existsSync(fullPath)) {
          fullPath = path.join(process.cwd(), 'workflows', w.path);
        }
        
        if (!fs.existsSync(fullPath)) {
          fullPath = path.join(process.cwd(), '..', w.path);
        }
        
        if (!fs.existsSync(fullPath)) return null;
        
        const extractedName = extractWorkflowName(fullPath);
        // For main workflow, use "Main" as the display name
        const displayName = w.id === 'main' 
          ? 'Main'
          : extractedName;
        
        return {
          id: w.id,
          name: displayName,
          path: w.path
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
    
    return {
      success: true,
      workflows: available
    };
  } catch (error) {
    console.error('Error listing workflows:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list workflows'
    };
  }
});

