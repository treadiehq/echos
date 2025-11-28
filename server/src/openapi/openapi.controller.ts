import { Controller, Post, Body, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OpenAPIParserService } from './openapi-parser.service';
import { WorkflowGeneratorService } from './workflow-generator.service';

@Controller('openapi')
@UseGuards(AuthGuard)
export class OpenAPIController {
  constructor(
    @Inject(OpenAPIParserService) private readonly parser: OpenAPIParserService,
    @Inject(WorkflowGeneratorService) private readonly generator: WorkflowGeneratorService,
  ) {}

  /**
   * Parse OpenAPI spec and return structured data
   */
  // SECURITY: Rate limit parsing (can fetch external URLs)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 per minute
  @Post('parse')
  async parseSpec(@Body() body: { spec: string | object }) {
    try {
      if (!body.spec) {
        throw new HttpException('spec is required', HttpStatus.BAD_REQUEST);
      }

      const parsed = await this.parser.parseSpec(body.spec);

      return {
        success: true,
        api: {
          title: parsed.title,
          version: parsed.version,
          description: parsed.description,
          baseUrl: parsed.baseUrl,
          servers: parsed.servers,
          endpointCount: parsed.endpoints.length,
          tags: parsed.tags,
          auth: parsed.auth,
        },
      };
    } catch (error) {
      console.error('[OpenAPIController] Parse error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate workflow YAML from OpenAPI spec
   */
  // SECURITY: Rate limit generation
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 per minute
  @Post('generate')
  async generateWorkflow(
    @Body()
    body: {
      spec: string | object;
      options?: {
        includeDataAgent?: boolean;
        maxCost?: number;
        rateLimits?: { requestsPerSecond?: number };
      };
    },
  ) {
    try {
      if (!body.spec) {
        throw new HttpException('spec is required', HttpStatus.BAD_REQUEST);
      }

      // Parse the spec
      const parsed = await this.parser.parseSpec(body.spec);

      // Generate workflow
      const workflow = this.generator.generateWorkflow(parsed, body.options || {});

      // Extract domains for summary
      const domains = parsed.servers.map((url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      });

      return {
        success: true,
        workflow,
        api: {
          title: parsed.title,
          version: parsed.version,
          description: parsed.description,
          endpointCount: parsed.endpoints.length,
          domains: [...new Set(domains)],
          authTypes: parsed.auth.map((a) => a.type),
        },
      };
    } catch (error) {
      console.error('[OpenAPIController] Generate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

