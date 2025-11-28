import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

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

/**
 * SECURITY: Check if hostname is a private/internal IP (SSRF protection)
 */
function isPrivateIP(hostname: string): boolean {
  // Check for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }
  
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // 169.254.0.0/16 (link-local) - AWS metadata!
    /^127\./,                   // 127.0.0.0/8 (loopback)
    /^0\.0\.0\.0$/,             // 0.0.0.0
    /^::1$/,                    // IPv6 loopback
    /^fe80:/i,                  // IPv6 link-local
    /^fc00:/i,                  // IPv6 private
    /^fd00:/i,                  // IPv6 private
  ];
  
  return privateRanges.some(range => range.test(hostname));
}

/**
 * SECURITY: Validate URL is safe to fetch (SSRF protection)
 */
function validateUrl(urlString: string): URL {
  // Limit URL length
  if (urlString.length > 2048) {
    throw new HttpException('URL too long (max 2048 characters)', HttpStatus.BAD_REQUEST);
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new HttpException('Invalid URL format', HttpStatus.BAD_REQUEST);
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpException('Only HTTP/HTTPS URLs are allowed', HttpStatus.BAD_REQUEST);
  }

  // Block private IPs (SSRF protection)
  if (isPrivateIP(url.hostname)) {
    throw new HttpException(
      'Private/internal URLs are not allowed for security reasons',
      HttpStatus.FORBIDDEN
    );
  }

  // Block cloud metadata endpoints specifically
  const metadataPatterns = [
    /^169\.254\.169\.254$/,     // AWS/GCP metadata
    /^metadata\.google\.internal$/i,
    /^metadata\.gcp\.internal$/i,
    /^100\.100\.100\.200$/,     // Alibaba Cloud metadata
  ];
  
  if (metadataPatterns.some(p => p.test(url.hostname))) {
    throw new HttpException(
      'Cloud metadata endpoints are blocked for security',
      HttpStatus.FORBIDDEN
    );
  }

  return url;
}

@Injectable()
export class OpenAPIParserService {
  /**
   * Parse OpenAPI spec from URL or object
   * SECURITY: Includes SSRF protection for URL fetching
   */
  async parseSpec(specInput: string | object): Promise<ParsedAPI> {
    let spec: any;

    // Handle URL input with SSRF protection
    if (typeof specInput === 'string' && (specInput.startsWith('http://') || specInput.startsWith('https://'))) {
      // SECURITY: Validate URL before fetching
      const validatedUrl = validateUrl(specInput);
      
      // Fetch with timeout to prevent slowloris attacks
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(validatedUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Echos-OpenAPI-Parser/1.0',
          },
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch spec from URL: ${response.statusText}`);
        }
        
        // SECURITY: Limit response size (5MB max for OpenAPI specs)
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
          throw new HttpException('OpenAPI spec too large (max 5MB)', HttpStatus.BAD_REQUEST);
        }
        
        spec = await response.json();
      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          throw new HttpException('Request timeout fetching OpenAPI spec', HttpStatus.REQUEST_TIMEOUT);
        }
        throw error;
      }
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

