import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import yaml from 'yaml';

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  yaml_config: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class WorkflowService {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}

  async createWorkflow(
    orgId: string,
    userId: string,
    name: string,
    yamlConfig: string,
    description?: string
  ): Promise<Workflow> {
    // Validate YAML
    try {
      yaml.parse(yamlConfig);
    } catch (error) {
      console.error('[WorkflowService] YAML validation failed:', error);
      throw new HttpException('Invalid YAML configuration: ' + (error instanceof Error ? error.message : String(error)), HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.db.query(
        `INSERT INTO workflows (org_id, name, description, yaml_config, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [orgId, name, description, yamlConfig, userId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('[WorkflowService] Database insert failed:', error);
      throw new HttpException('Failed to save workflow to database: ' + (error instanceof Error ? error.message : String(error)), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getWorkflow(workflowId: string, orgId: string): Promise<Workflow | null> {
    const result = await this.db.query(
      `SELECT * FROM workflows WHERE id = $1 AND org_id = $2`,
      [workflowId, orgId]
    );

    return result.rows[0] || null;
  }

  async getWorkflowByName(name: string, orgId: string): Promise<Workflow | null> {
    const result = await this.db.query(
      `SELECT * FROM workflows WHERE name = $1 AND org_id = $2`,
      [name, orgId]
    );

    return result.rows[0] || null;
  }

  async listWorkflows(orgId: string): Promise<Workflow[]> {
    const result = await this.db.query(
      `SELECT * FROM workflows WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    return result.rows;
  }

  async updateWorkflow(
    workflowId: string,
    orgId: string,
    updates: {
      name?: string;
      description?: string;
      yaml_config?: string;
    }
  ): Promise<Workflow> {
    // Validate YAML if provided
    if (updates.yaml_config) {
      try {
        yaml.parse(updates.yaml_config);
      } catch (error) {
        throw new HttpException('Invalid YAML configuration', HttpStatus.BAD_REQUEST);
      }
    }

    const result = await this.db.query(
      `UPDATE workflows 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           yaml_config = COALESCE($3, yaml_config),
           updated_at = NOW()
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [updates.name, updates.description, updates.yaml_config, workflowId, orgId]
    );

    if (result.rows.length === 0) {
      throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
    }

    return result.rows[0];
  }

  async deleteWorkflow(workflowId: string, orgId: string): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM workflows WHERE id = $1 AND org_id = $2`,
      [workflowId, orgId]
    );

    if (result.rowCount === 0) {
      throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
    }
  }

  async getDiagram(workflowId: string, orgId: string) {
    try {
      const workflow = await this.getWorkflow(workflowId, orgId);
      
      if (!workflow) {
        throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
      }

      const config = yaml.parse(workflow.yaml_config);
      const diagram = this.generateWorkflowDiagram(config);
      
      return {
        diagram,
        mermaid: diagram.replace(/```mermaid\n|```/g, ''), // Extract just the mermaid syntax
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load workflow',
        diagram: null,
        mermaid: null,
      };
    }
  }

  async getDocs(workflowId: string, orgId: string) {
    try {
      const workflow = await this.getWorkflow(workflowId, orgId);
      
      if (!workflow) {
        throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
      }

      const config = yaml.parse(workflow.yaml_config);
      const diagram = this.generateWorkflowDiagram(config);
      
      const lines: string[] = [];
      lines.push(`# ${workflow.name}`);
      lines.push("");
      if (workflow.description) {
        lines.push(workflow.description);
        lines.push("");
      }
      lines.push(diagram);
      lines.push("");
      lines.push("## Agents");
      config.agents.forEach((agent: any) => {
        lines.push(`### ${agent.name} (${agent.type})`);
        lines.push(`- Max Loops: ${agent.maxLoops || 'unlimited'}`);
        if (agent.policy?.guardrails) {
          lines.push(`- Guardrails: ✅ Enabled`);
        }
      });
      
      const docs = lines.join("\n");
      
      return {
        docs,
        markdown: docs,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load workflow',
        docs: null,
      };
    }
  }

  async getConfig(workflowId: string, orgId: string) {
    try {
      const workflow = await this.getWorkflow(workflowId, orgId);
      
      if (!workflow) {
        throw new HttpException('Workflow not found', HttpStatus.NOT_FOUND);
      }

      const config = yaml.parse(workflow.yaml_config);
      
      return {
        workflow: config,
        agents: config.agents.map((a: any) => ({
          name: a.name,
          type: a.type,
          maxLoops: a.maxLoops,
          hasGuardrails: !!a.policy?.guardrails,
          hasRetries: !!a.policy?.retries,
        })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load workflow',
        workflow: null,
      };
    }
  }

  private generateWorkflowDiagram(config: any): string {
    const lines: string[] = [];
    
    lines.push("```mermaid");
    lines.push("graph TD");
    lines.push("  Start((Start)) --> Orchestrator");
    
    const orchestrator = config.agents.find((a: any) => a.type === "orchestrator");
    if (orchestrator) {
      lines.push(`  Orchestrator[${orchestrator.name}]:::orchestrator`);
      const routes = config.routes?.[orchestrator.name]?.canCall || [];
      routes.forEach((targetAgent: string) => {
        lines.push(`  Orchestrator --> ${targetAgent}[${targetAgent}]:::worker`);
      });
    }
    
    const workers = config.agents.filter((a: any) => a.type === "worker");
    workers.forEach((worker: any) => {
      const routes = config.routes?.[worker.name]?.canCall || [];
      routes.forEach((targetAgent: string) => {
        lines.push(`  ${worker.name} --> ${targetAgent}[${targetAgent}]:::worker`);
      });
      if (routes.length === 0) {
        lines.push(`  ${worker.name} --> End((End))`);
      }
    });
    
    lines.push("");
    lines.push("  classDef orchestrator fill:#4f46e5,stroke:#333,stroke-width:2px,color:#fff");
    lines.push("  classDef worker fill:#10b981,stroke:#333,stroke-width:2px,color:#fff");
    lines.push("```");
    
    return lines.join("\n");
  }
}

