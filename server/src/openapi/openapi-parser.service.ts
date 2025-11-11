import { Injectable } from '@nestjs/common';

export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: Array<{
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    required: boolean;
    schema: any;
    description?: string;
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, any>;
  };
  responses: Record<string, any>;
  security?: Array<Record<string, string[]>>;
}

export interface ParsedAPI {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  servers: string[];
  auth: {
    type: 'apiKey' | 'bearer' | 'oauth2' | 'basic' | 'none';
    in?: 'header' | 'query';
    name?: string;
  }[];
  endpoints: ParsedEndpoint[];
  tags: Array<{ name: string; description?: string }>;
}

@Injectable()
export class OpenAPIParserService {
  /**
   * Parse OpenAPI spec from URL or object
   */
  async parseSpec(specInput: string | object): Promise<ParsedAPI> {
    let spec: any;

    // Handle URL input
    if (typeof specInput === 'string' && (specInput.startsWith('http://') || specInput.startsWith('https://'))) {
      const response = await fetch(specInput);
      if (!response.ok) {
        throw new Error(`Failed to fetch spec from URL: ${response.statusText}`);
      }
      spec = await response.json();
    } else if (typeof specInput === 'string') {
      // Try parsing as JSON
      try {
        spec = JSON.parse(specInput);
      } catch {
        throw new Error('Invalid JSON spec');
      }
    } else {
      spec = specInput;
    }

    // Validate it's an OpenAPI spec
    if (!spec.openapi && !spec.swagger) {
      throw new Error('Not a valid OpenAPI/Swagger spec');
    }

    // Extract servers
    const servers = this.extractServers(spec);
    const baseUrl = servers[0] || '';

    // Extract security schemes
    const auth = this.extractAuth(spec);

    // Parse all endpoints
    const endpoints: ParsedEndpoint[] = [];
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;

        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags || [],
          parameters: this.parseParameters(operation.parameters || []),
          requestBody: operation.requestBody,
          responses: operation.responses || {},
          security: operation.security,
        });
      }
    }

    return {
      title: spec.info?.title || 'Untitled API',
      version: spec.info?.version || '1.0.0',
      description: spec.info?.description,
      baseUrl,
      servers,
      auth,
      endpoints,
      tags: spec.tags || [],
    };
  }

  private extractServers(spec: any): string[] {
    // OpenAPI 3.x
    if (spec.servers && Array.isArray(spec.servers)) {
      return spec.servers.map((s: any) => s.url).filter(Boolean);
    }

    // Swagger 2.0
    if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      const basePath = spec.basePath || '';
      return [`${scheme}://${spec.host}${basePath}`];
    }

    return [];
  }

  private extractAuth(spec: any): ParsedAPI['auth'] {
    const schemes: Record<string, any> = 
      spec.components?.securitySchemes || 
      spec.securityDefinitions || 
      {};

    return Object.entries(schemes).map(([name, scheme]: [string, any]) => {
      if (scheme.type === 'http') {
        if (scheme.scheme === 'bearer') {
          return { type: 'bearer', name };
        }
        if (scheme.scheme === 'basic') {
          return { type: 'basic', name };
        }
      }

      if (scheme.type === 'apiKey') {
        return {
          type: 'apiKey',
          name: scheme.name,
          in: scheme.in,
        };
      }

      if (scheme.type === 'oauth2') {
        return { type: 'oauth2', name };
      }

      return { type: 'none' };
    });
  }

  private parseParameters(params: any[]): ParsedEndpoint['parameters'] {
    if (!Array.isArray(params)) return [];

    return params.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required || false,
      schema: p.schema,
      description: p.description,
    }));
  }
}

