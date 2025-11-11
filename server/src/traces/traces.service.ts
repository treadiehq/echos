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
        data->>'taskId' as task_id,
        COALESCE(data->>'startedAt', created_at::text) as created_at,
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
        data->>'taskId' as task_id,
        COALESCE(data->>'startedAt', created_at::text) as created_at,
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

  async replayTrace(traceId: string, orgId: string, modifiedWorkflowConfig: any): Promise<any> {
    // Get the original trace
    const originalTrace = await this.getTrace(traceId, orgId);
    
    if (!originalTrace) {
      throw new HttpException('Trace not found', HttpStatus.NOT_FOUND);
    }

    // Check if trace has the required data for replay
    if (!originalTrace.data.workflowConfig) {
      throw new HttpException(
        'This trace does not contain workflow configuration data. Only traces created after the time-travel debugging feature was added can be replayed.',
        HttpStatus.BAD_REQUEST
      );
    }

    // Import EchosRuntime dynamically to avoid circular dependencies
    try {
      const { EchosRuntime } = await import('../../../dist/runtime.js');
      
      // Use the API key from environment variables
      // Note: API keys are hashed in the database for security, so we can't retrieve them
      const apiKey = process.env.ECHOS_API_KEY;
      
      if (!apiKey) {
        throw new HttpException(
          'ECHOS_API_KEY environment variable is required for Time-Travel Debug. Please set it in your .env file.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      // Use environment variable for API URL (works in both dev and production)
      const apiUrl = process.env.ECHOS_API_URL || 'http://localhost:4000';
      
      // Create runtime with the modified workflow config directly
      const runtime = new EchosRuntime({
        apiKey,
        apiUrl,
        workflowConfig: modifiedWorkflowConfig
      });
      
      // Skip API validation since we're running on the server
      // We're already authenticated via the API endpoint
      (runtime as any).orgId = orgId;
      
      // Replay the trace with the original task and memory
      const result = await runtime.run({
        task: originalTrace.data.initialTask || 'Replay trace',
        memory: originalTrace.data.initialMemory || {}
      });
      
      return result;
    } catch (error: any) {
      console.error('Error replaying trace:', error);
      throw new HttpException(
        `Failed to replay trace: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

