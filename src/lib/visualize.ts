import type { WorkflowConfig } from "../types";

/**
 * Generate a Mermaid diagram from workflow configuration
 * Useful for documentation and understanding workflow structure
 */
export function generateWorkflowDiagram(workflow: WorkflowConfig): string {
  const lines: string[] = [];
  
  lines.push("```mermaid");
  lines.push("graph TD");
  lines.push("  Start((Start)) --> Orchestrator");
  
  // Add orchestrator node
  const orchestrator = workflow.agents.find(a => a.type === "orchestrator");
  if (orchestrator) {
    lines.push(`  Orchestrator[${orchestrator.name}]:::orchestrator`);
    
    // Add routes from orchestrator
    const routes = workflow.routes?.[orchestrator.name]?.canCall || [];
    routes.forEach(targetAgent => {
      lines.push(`  Orchestrator --> ${targetAgent}[${targetAgent}]:::worker`);
    });
  }
  
  // Add worker agents and their connections
  const workers = workflow.agents.filter(a => a.type === "worker");
  workers.forEach(worker => {
    const routes = workflow.routes?.[worker.name]?.canCall || [];
    routes.forEach(targetAgent => {
      lines.push(`  ${worker.name} --> ${targetAgent}[${targetAgent}]:::worker`);
    });
    
    // If worker can complete, show return to orchestrator or end
    if (routes.length === 0) {
      lines.push(`  ${worker.name} --> End((End))`);
    }
  });
  
  // Add styling
  lines.push("");
  lines.push("  classDef orchestrator fill:#4f46e5,stroke:#333,stroke-width:2px,color:#fff");
  lines.push("  classDef worker fill:#10b981,stroke:#333,stroke-width:2px,color:#fff");
  lines.push("```");
  
  return lines.join("\n");
}

/**
 * Generate a detailed workflow documentation
 */
export function generateWorkflowDocs(workflow: WorkflowConfig): string {
  const lines: string[] = [];
  
  lines.push("# Workflow Configuration");
  lines.push("");
  lines.push(generateWorkflowDiagram(workflow));
  lines.push("");
  
  // Global limits
  if (workflow.limits) {
    lines.push("## Global Limits");
    lines.push("");
    lines.push(`- **Max Duration:** ${workflow.limits.maxDurationMs}ms`);
    lines.push(`- **Max Cost:** $${workflow.limits.maxCost}`);
    lines.push(`- **Default Max Loops:** ${workflow.limits.defaultMaxLoops}`);
    lines.push("");
  }
  
  // Agents
  lines.push("## Agents");
  lines.push("");
  
  workflow.agents.forEach(agent => {
    lines.push(`### ${agent.name}`);
    lines.push("");
    lines.push(`**Type:** ${agent.type}`);
    
    if (agent.maxLoops) {
      lines.push(`**Max Loops:** ${agent.maxLoops}`);
    }
    
    // Policy
    if (agent.policy) {
      lines.push("");
      lines.push("**Policy:**");
      
      if (agent.policy.retries) {
        lines.push(`- Retries: ${agent.policy.retries.count} (backoff: ${agent.policy.retries.backoffMs}ms)`);
      }
      
      if (agent.policy.fallback) {
        lines.push(`- Fallback: ${agent.policy.fallback}`);
      }
      
      if (agent.policy.memoryPolicy) {
        lines.push(`- Read From: ${agent.policy.memoryPolicy.readFrom?.join(', ') || 'none'}`);
        lines.push(`- Write To: ${agent.policy.memoryPolicy.writeTo || 'none'}`);
      }
      
      // Guardrails
      if (agent.policy.guardrails) {
        lines.push("");
        lines.push("**Guardrails:**");
        const gr = agent.policy.guardrails;
        
        if (gr.maxCostPerInvocation) {
          lines.push(`- Max Cost: $${gr.maxCostPerInvocation}`);
        }
        
        if (gr.allowedOperations) {
          lines.push(`- Allowed Operations: ${gr.allowedOperations.join(', ')}`);
        }
        
        if (gr.allowedTables) {
          lines.push(`- Allowed Tables: ${gr.allowedTables.join(', ')}`);
        }
        
        if (gr.allowedDomains) {
          lines.push(`- Allowed Domains: ${gr.allowedDomains.join(', ')}`);
        }
        
        if (gr.allowedMethods) {
          lines.push(`- Allowed Methods: ${gr.allowedMethods.join(', ')}`);
        }
        
        if (gr.blockPrivateIPs) {
          lines.push(`- Block Private IPs: Yes (SSRF protection)`);
        }
        
        if (gr.requireWhere) {
          lines.push(`- Require WHERE: Yes (prevents full table operations)`);
        }
      }
    }
    
    // Routes
    const routes = workflow.routes?.[agent.name]?.canCall;
    if (routes && routes.length > 0) {
      lines.push("");
      lines.push(`**Can Call:** ${routes.join(', ')}`);
    }
    
    lines.push("");
  });
  
  // Memory
  if (workflow.memory) {
    lines.push("## Pre-seeded Memory");
    lines.push("");
    Object.entries(workflow.memory).forEach(([namespace, data]) => {
      lines.push(`### ${namespace}`);
      lines.push("```json");
      lines.push(JSON.stringify(data, null, 2));
      lines.push("```");
      lines.push("");
    });
  }
  
  return lines.join("\n");
}

