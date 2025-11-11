import { Injectable } from '@nestjs/common';
import { ParsedAPI, ParsedEndpoint } from './openapi-parser.service';
import { stringify as yamlStringify } from 'yaml';

interface GenerationOptions {
  includeDataAgent?: boolean;
  maxCost?: number;
  rateLimits?: { requestsPerSecond?: number };
}

@Injectable()
export class WorkflowGeneratorService {
  /**
   * Generate workflow YAML from parsed API spec
   */
  generateWorkflow(parsedAPI: ParsedAPI, options: GenerationOptions = {}): string {
    const domains = this.extractDomains(parsedAPI.servers);
    const methods = this.extractMethods(parsedAPI.endpoints);

    const workflow: any = {
      name: `${parsedAPI.title} Agent`,

      agents: [
        {
          name: 'orchestrator',
          type: 'orchestrator',
          maxLoops: 3,
          policy: {
            retries: { count: 1, backoffMs: 250 },
            memoryPolicy: {
              readFrom: ['global'],
              writeTo: 'orchestrator',
            },
            guardrails: {
              maxCostPerInvocation: 0.5,
            },
          },
        },
        {
          name: 'api_agent',
          type: 'worker',
          maxLoops: 2,
          policy: {
            retries: { count: 3, backoffMs: 1000 },
            memoryPolicy: {
              readFrom: ['global', 'orchestrator'],
              writeTo: 'api',
            },
            guardrails: {
              maxCostPerInvocation: 0.5,
              allowedDomains: domains,
              allowedMethods: methods,
              allowedEndpoints: this.generateAllowedEndpoints(parsedAPI.endpoints),
              blockPrivateIPs: true,
            },
          },
        },
      ],

      routes: {
        orchestrator: {
          canCall: ['api_agent'],
        },
      },

      limits: {
        defaultMaxLoops: 3,
        maxDurationMs: 60000,
        maxCost: options.maxCost || 5.0,
      },

      memory: {
        global: {
          api_spec: {
            title: parsedAPI.title,
            version: parsedAPI.version,
            baseUrl: parsedAPI.baseUrl,
            description: parsedAPI.description,
            endpoints: this.generateEndpointDocs(parsedAPI.endpoints),
          },
          auth: this.generateAuthConfig(parsedAPI.auth),
        },
      },
    };

    // Optionally add data_agent
    if (options.includeDataAgent) {
      workflow.agents.push({
        name: 'data_agent',
        type: 'worker',
        maxLoops: 2,
        policy: {
          retries: { count: 1, backoffMs: 200 },
          memoryPolicy: {
            readFrom: ['global', 'orchestrator', 'api'],
            writeTo: 'analysis',
          },
          guardrails: { maxCostPerInvocation: 1.0 },
        },
      });
      workflow.routes.orchestrator.canCall.push('data_agent');
      workflow.routes.api_agent = { canCall: ['data_agent'] };
    }

    // Convert to YAML with nice formatting
    return yamlStringify(workflow, {
      indent: 2,
      lineWidth: -1,
    });
  }

  private extractDomains(servers: string[]): string[] {
    const domains = servers
      .map((url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      })
      .filter((d): d is string => Boolean(d));

    return [...new Set(domains)]; // Remove duplicates
  }

  private extractMethods(endpoints: ParsedEndpoint[]): string[] {
    const methods = new Set(endpoints.map((e) => e.method));
    return Array.from(methods).sort();
  }

  private generateEndpointDocs(endpoints: ParsedEndpoint[]) {
    // Group by tag for better organization
    const grouped: Record<string, any[]> = {};

    for (const endpoint of endpoints) {
      const tag = endpoint.tags[0] || 'General';

      if (!grouped[tag]) {
        grouped[tag] = [];
      }

      grouped[tag].push({
        path: endpoint.path,
        method: endpoint.method,
        summary: endpoint.summary,
        operationId: endpoint.operationId,
        description: endpoint.description,
        parameters: endpoint.parameters.map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.schema?.type,
          description: p.description,
        })),
      });
    }

    return grouped;
  }

  private generateAuthConfig(auth: ParsedAPI['auth']) {
    if (auth.length === 0) {
      return {
        type: 'none',
        instructions: 'No authentication required',
      };
    }

    const primary = auth[0];
    return {
      type: primary.type,
      ...(primary.name && { name: primary.name }),
      ...(primary.in && { location: primary.in }),
      instructions: this.getAuthInstructions(primary),
    };
  }

  private getAuthInstructions(authScheme: ParsedAPI['auth'][0]): string {
    switch (authScheme.type) {
      case 'bearer':
        return 'Set Authorization: Bearer YOUR_TOKEN in request headers';
      case 'apiKey':
        return `Provide API key as ${authScheme.name} in ${authScheme.in}`;
      case 'oauth2':
        return 'Complete OAuth2 flow to obtain access token';
      case 'basic':
        return 'Use HTTP Basic Authentication (username:password)';
      default:
        return 'No authentication required';
    }
  }

  private generateAllowedEndpoints(endpoints: ParsedEndpoint[]): string[] {
    return endpoints.map(endpoint => {
      // Format: "METHOD /path/to/endpoint"
      return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    });
  }
}

