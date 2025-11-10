import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WorkflowService } from '../workflow/workflow.service';

export interface Trace {
  id: string;
  org_id: string;
  workflow_id?: string;
  data: any;
  created_at: Date;
}

export interface TraceMetadata {
  id: string;
  org_id: string;
  workflow_id?: string;
  created_at: Date;
  size: number;
}

@Injectable()
export class TracesService {
  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(WorkflowService) private workflowService: WorkflowService
  ) {}

  async createTrace(orgId: string, data: any, workflowId?: string, workflowName?: string): Promise<Trace> {
    let finalWorkflowId = workflowId;
    
    // If workflowName is provided but not workflowId, lookup or create the workflow
    if (!finalWorkflowId && workflowName) {
      let workflow = await this.workflowService.getWorkflowByName(workflowName, orgId);
      
      if (!workflow) {
        // Auto-create a placeholder workflow for embedded/CLI usage
        // We don't have userId here, so we'll use a system user ID or the first user in the org
        const systemUserId = await this.getSystemUserId(orgId);
        workflow = await this.workflowService.createWorkflow(
          orgId,
          systemUserId,
          workflowName,
          '# Auto-generated workflow\nagents: []\nroutes: {}\n',
          'Auto-generated workflow from runtime'
        );
      }
      
      finalWorkflowId = workflow.id;
    }
    
    const result = await this.db.query(
      `INSERT INTO traces (org_id, workflow_id, data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orgId, finalWorkflowId || null, data]
    );

    return result.rows[0];
  }
  
  private async getSystemUserId(orgId: string): Promise<string> {
    // Get the first user in the organization to use as creator
    const result = await this.db.query(
      `SELECT user_id FROM org_members WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('No users found in organization');
    }
    
    return result.rows[0].user_id;
  }

  async listTraces(orgId: string, limit: number = 50): Promise<TraceMetadata[]> {
    const result = await this.db.query(
      `SELECT 
        id,
        org_id,
        workflow_id,
        created_at,
        octet_length(data::text) as size
       FROM traces
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );

    return result.rows;
  }

  async getTrace(traceId: string, orgId: string): Promise<Trace | null> {
    const result = await this.db.query(
      `SELECT * FROM traces WHERE id = $1 AND org_id = $2`,
      [traceId, orgId]
    );

    return result.rows[0] || null;
  }

  async getTracesByWorkflow(workflowId: string, orgId: string, limit: number = 50): Promise<TraceMetadata[]> {
    const result = await this.db.query(
      `SELECT 
        id,
        org_id,
        workflow_id,
        created_at,
        octet_length(data::text) as size
       FROM traces
       WHERE workflow_id = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [workflowId, orgId, limit]
    );

    return result.rows;
  }

  async deleteTrace(traceId: string, orgId: string): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM traces WHERE id = $1 AND org_id = $2`,
      [traceId, orgId]
    );

    if (result.rowCount === 0) {
      throw new HttpException('Trace not found', HttpStatus.NOT_FOUND);
    }
  }

  async deleteOldTraces(orgId: string, daysOld: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM traces 
       WHERE org_id = $1 
       AND created_at < NOW() - INTERVAL '${daysOld} days'`,
      [orgId]
    );

    return result.rowCount || 0;
  }
}

