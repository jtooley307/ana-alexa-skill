import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createLogger } from '../utils/logger';

const logger = createLogger('BedrockService');

interface BedrockConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stopSequences: string[];
}

export interface ExtractedEntities {
  intent?: 'RecommendDish' | 'RecommendMeal' | 'RecommendRestaurant' | 'Unknown';
  dishName?: string;
  cuisine?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  location?: string;
  budget?: boolean;
  quick?: boolean;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private config: BedrockConfig;

  constructor() {
    this.config = {
      region: process.env.AWS_REGION || 'us-west-2',
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      maxTokens: 48,
      temperature: 0.0,
      topP: 0.9,
      stopSequences: []
    };
    
    this.client = new BedrockRuntimeClient({
      region: this.config.region,
      credentials: fromNodeProviderChain()
    });
  }

  /**
   * Extract entities from natural language query using Amazon Bedrock
   * @param query The user's natural language query
   * @returns Extracted entities and intent
   */
  async extractEntities(query: string): Promise<ExtractedEntities> {
    try {
      logger.info('Extracting entities with Bedrock', { 
        context: 'BedrockService',
        query 
      });
      
      logger.info('Creating BedrockRuntimeClient', { 
        context: 'BedrockService',
        region: this.config.region,
        modelId: this.config.modelId 
      });

      const startTime = Date.now();
      const bedrockRuntime = new BedrockRuntimeClient({
        region: this.config.region,
        credentials: fromNodeProviderChain()
      });
      
      logger.info(`[BedrockService] BedrockRuntimeClient created successfully`);

      const prompt = this.buildPrompt(query);
      // Soft timeout: if Bedrock takes too long, fall back gracefully
      const softTimeoutMs = 900;
      const response = await Promise.race<string>([
        this.invokeModel(prompt),
        new Promise<string>((_resolve, reject) => setTimeout(() => reject(new Error('Bedrock soft timeout exceeded')), softTimeoutMs))
      ]);
      
      logger.info(`[BedrockService] Received response from Bedrock`, { 
        response: response,
        latency: Date.now() - startTime
      });
      
      // Parse the response and extract entities
      return this.parseResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error extracting entities with Bedrock: ${errorMessage} [query: ${query}]`);
      return { intent: 'Unknown' };
    }
  }

  private buildPrompt(query: string): string {
    return `
You are an AI assistant that extracts food and dining related information from user queries.
Extract the following entities from the query and return them in JSON format:
- intent: One of [RecommendDish, RecommendMeal, RecommendRestaurant, Unknown]
- dishName: The specific dish name if mentioned
- cuisine: Type of cuisine (e.g., Italian, Mexican, Chinese)
- mealType: One of [breakfast, lunch, dinner] if mentioned
- location: Location for restaurant search if mentioned
- budget: true if the user is looking for something cheap/affordable
- quick: true if the user is in a hurry

Query: "${query}"

Return only the JSON object with the extracted entities. If an entity is not found, omit it from the response.

Example response for "Find me a cheap Italian restaurant near downtown":
{
  "intent": "RecommendRestaurant",
  "cuisine": "Italian",
  "location": "downtown",
  "budget": true
}

JSON Response:`;
  }

  private async invokeModel(prompt: string): Promise<string> {
    logger.info('[BedrockService] Starting invokeModel', { 
      modelId: this.config.modelId,
      promptLength: prompt.length 
    });

    try {
      // Format the prompt for Claude 3 Haiku
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ];

      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: this.config.maxTokens,
          messages: messages,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          stop_sequences: this.config.stopSequences,
        }),
      });

      logger.info('[BedrockService] Sending request to Bedrock...');
      const startTime = Date.now();
      
      try {
        const response = await this.client.send(command);
        const duration = Date.now() - startTime;
        
        logger.info('[BedrockService] Received response from Bedrock', { 
          durationMs: duration,
          statusCode: response.$metadata.httpStatusCode 
        });
        
        return new TextDecoder().decode(response.body);
      } catch (err) {
        const error = err as Error;
        const duration = Date.now() - startTime;
        
        // Create a new error with enhanced information
        const enhancedError = new Error(`Bedrock API call failed after ${duration}ms: ${error.message}`);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        
        // Log the error with additional context
        logger.error('Error in Bedrock API call', enhancedError, {
          context: 'BedrockService',
          durationMs: duration,
          modelId: this.config.modelId
        });
        
        throw enhancedError;
      }
    } catch (error) {
      const err = error as Error;
      
      // Create a new error with enhanced information
      const enhancedError = new Error(`Error in invokeModel: ${err.message}`);
      enhancedError.name = err.name;
      enhancedError.stack = err.stack;
      
      // Log the error with additional context
      logger.error('Error in invokeModel', enhancedError, {
        context: 'BedrockService',
        modelId: this.config.modelId
      });
      
      throw enhancedError;
    }
  }

  private parseResponse(response: string): ExtractedEntities {
    try {
      // Claude 3 Haiku response is already a JSON object with a 'content' array
      const parsed = JSON.parse(response);
      const result: ExtractedEntities = {};
      
      // Extract the text content from the response
      let content = '';
      if (parsed.content && Array.isArray(parsed.content)) {
        content = parsed.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join('\n');
      }
      
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response content');
      }
      
      const contentObj = JSON.parse(jsonMatch[0]);
      
      // Map and validate the response
      if (['RecommendDish', 'RecommendMeal', 'RecommendRestaurant', 'Unknown'].includes(contentObj.intent)) {
        result.intent = contentObj.intent;
      } else {
        result.intent = 'Unknown';
      }
      
      if (contentObj.dishName) result.dishName = contentObj.dishName;
      if (contentObj.cuisine) result.cuisine = contentObj.cuisine;
      if (contentObj.mealType && ['breakfast', 'lunch', 'dinner'].includes(contentObj.mealType.toLowerCase())) {
        result.mealType = contentObj.mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
      }
      if (contentObj.location) result.location = contentObj.location;
      if (contentObj.budget !== undefined) result.budget = Boolean(contentObj.budget);
      if (contentObj.quick !== undefined) result.quick = Boolean(contentObj.quick);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error parsing Bedrock response: ${errorMessage} [response: ${response}]`);
      return { intent: 'Unknown' };
    }
  }
}

// Singleton instance
export const bedrockService = new BedrockService();
