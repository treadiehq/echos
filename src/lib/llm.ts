import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Config } from "../config.js";
import type { StepMetadata } from "../types.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  metadata: StepMetadata;
}

export interface LLMClient {
  chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse>;
}

class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      });

      const duration = Date.now() - startTime;
      const usage = response.usage;
      
      // Rough cost estimation (GPT-4 pricing)
      const promptCost = (usage?.prompt_tokens ?? 0) * 0.00003;
      const completionCost = (usage?.completion_tokens ?? 0) * 0.00006;

      return {
        content: response.choices[0]?.message?.content ?? "",
        metadata: {
          duration,
          tokens: {
            prompt: usage?.prompt_tokens,
            completion: usage?.completion_tokens,
            total: usage?.total_tokens,
          },
          cost: promptCost + completionCost,
          model: this.model,
          provider: "openai",
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Extract system message if present
      const systemMessage = messages.find(m => m.role === "system")?.content;
      const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? 2000,
        temperature: options?.temperature ?? 0.7,
        system: systemMessage,
        messages: chatMessages,
      });

      const duration = Date.now() - startTime;
      const usage = response.usage;
      
      // Rough cost estimation (Claude pricing)
      const promptCost = (usage?.input_tokens ?? 0) * 0.000003;
      const completionCost = (usage?.output_tokens ?? 0) * 0.000015;

      return {
        content: response.content[0]?.type === "text" ? response.content[0].text : "",
        metadata: {
          duration,
          tokens: {
            prompt: usage?.input_tokens,
            completion: usage?.output_tokens,
            total: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
          },
          cost: promptCost + completionCost,
          model: this.model,
          provider: "anthropic",
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class BedrockClient implements LLMClient {
  private client: BedrockRuntimeClient;
  private model: string;

  constructor(region: string, model: string, credentials?: { accessKeyId: string; secretAccessKey: string }) {
    const clientConfig: any = { region };
    
    // If credentials are provided, use them. Otherwise, SDK will use default credential chain
    // (environment variables, IAM role, etc.)
    if (credentials) {
      clientConfig.credentials = credentials;
    }
    
    this.client = new BedrockRuntimeClient(clientConfig);
    this.model = model;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Format messages based on the model provider
      const isAnthropicModel = this.model.includes("anthropic");
      const isTitanModel = this.model.includes("amazon.titan");
      
      let requestBody: any;
      
      if (isAnthropicModel) {
        // Anthropic Claude models on Bedrock
        const systemMessage = messages.find(m => m.role === "system")?.content;
        const chatMessages = messages.filter(m => m.role !== "system").map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        
        requestBody = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: options?.maxTokens ?? 2000,
          temperature: options?.temperature ?? 0.7,
          messages: chatMessages,
        };
        
        if (systemMessage) {
          requestBody.system = systemMessage;
        }
      } else if (isTitanModel) {
        // Amazon Titan models
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");
        requestBody = {
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: options?.maxTokens ?? 2000,
            temperature: options?.temperature ?? 0.7,
          },
        };
      } else {
        // Generic format - adjust as needed for other models
        requestBody = {
          prompt: messages.map(m => `${m.role}: ${m.content}`).join("\n\n"),
          max_tokens: options?.maxTokens ?? 2000,
          temperature: options?.temperature ?? 0.7,
        };
      }

      const command = new InvokeModelCommand({
        modelId: this.model,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(requestBody),
      });

      const response = await this.client.send(command);
      const duration = Date.now() - startTime;
      
      // Parse response body
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;
      
      if (isAnthropicModel) {
        content = responseBody.content?.[0]?.text ?? "";
        inputTokens = responseBody.usage?.input_tokens ?? 0;
        outputTokens = responseBody.usage?.output_tokens ?? 0;
      } else if (isTitanModel) {
        content = responseBody.results?.[0]?.outputText ?? "";
        inputTokens = responseBody.inputTextTokenCount ?? 0;
        outputTokens = responseBody.results?.[0]?.tokenCount ?? 0;
      } else {
        content = responseBody.completion ?? responseBody.text ?? JSON.stringify(responseBody);
        inputTokens = responseBody.usage?.input_tokens ?? 0;
        outputTokens = responseBody.usage?.output_tokens ?? 0;
      }
      
      const totalTokens = inputTokens + outputTokens;
      
      // Bedrock pricing varies by model - using approximate Claude on Bedrock pricing
      const promptCost = inputTokens * 0.000003;
      const completionCost = outputTokens * 0.000015;

      return {
        content,
        metadata: {
          duration,
          tokens: {
            prompt: inputTokens,
            completion: outputTokens,
            total: totalTokens,
          },
          cost: promptCost + completionCost,
          model: this.model,
          provider: "bedrock",
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw new Error(`AWS Bedrock API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function createLLMClient(config: Config): LLMClient {
  if (config.llmProvider === "bedrock") {
    // For Bedrock, credentials are optional - will use IAM role if not provided
    const credentials = config.awsAccessKeyId && config.awsSecretAccessKey
      ? { accessKeyId: config.awsAccessKeyId, secretAccessKey: config.awsSecretAccessKey }
      : undefined;
    
    return new BedrockClient(config.bedrockRegion, config.bedrockModel, credentials);
  } else if (config.llmProvider === "anthropic") {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when using Anthropic");
    }
    return new AnthropicClient(config.anthropicApiKey, config.anthropicModel);
  } else {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when using OpenAI");
    }
    return new OpenAIClient(config.openaiApiKey, config.openaiModel);
  }
}

