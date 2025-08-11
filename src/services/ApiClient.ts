import { fetch } from 'undici';
import { AbortController } from 'node-abort-controller';
import { createLogger } from '../utils/logger';

const logger = createLogger('api-client');

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 2;

interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

export interface HistoricalDishParams {
  query?: string;
  cuisine?: string;
  era?: string;
  limit?: number;
}

export interface RestaurantParams {
  query?: string;
  location?: string;
  limit?: number;
}

export interface RecipeParams {
  dish: string;
  limit?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export class ApiClient {
  private historicalDishesConfig: Required<ApiConfig>;
  private restaurantsConfig: Required<ApiConfig>;
  private recipesConfig: Required<ApiConfig>;

  constructor() {
    this.historicalDishesConfig = {
      baseUrl: (process.env.HISTORICAL_API_BASE || 'https://2kfsa0b68h.execute-api.us-west-2.amazonaws.com/prod/historical-dishes').trim(),
      timeout: parseInt(process.env.API_TIMEOUT_MS || DEFAULT_TIMEOUT.toString(), 10)
    };
    
    this.restaurantsConfig = {
      baseUrl: (process.env.RESTAURANT_API_BASE || 'https://4ccoyys838.execute-api.us-west-2.amazonaws.com/prod/restaurants').trim(),
      timeout: parseInt(process.env.API_TIMEOUT_MS || DEFAULT_TIMEOUT.toString(), 10)
    };
    
    this.recipesConfig = {
      baseUrl: (process.env.RECIPES_API_BASE || 'https://api.example.com/recipes').trim(),
      timeout: parseInt(process.env.API_TIMEOUT_MS || DEFAULT_TIMEOUT.toString(), 10)
    };
  }

  public async getHistoricalDishes(params: HistoricalDishParams = {}): Promise<ApiResponse<any>> {
    const url = this.buildUrl(this.historicalDishesConfig.baseUrl, params);
    return this.makeRequest(url);
  }

  public async getRestaurants(params: RestaurantParams = {}): Promise<ApiResponse<any>> {
    const url = this.buildUrl(this.restaurantsConfig.baseUrl, params);
    return this.makeRequest(url);
  }

  public async getRecipes(params: RecipeParams): Promise<ApiResponse<any>> {
    const url = this.buildUrl(this.recipesConfig.baseUrl, params);
    return this.makeRequest(url);
  }

  private async makeRequest<T>(
    url: string, 
    options: any = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = this.historicalDishesConfig.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const data = (await response.json()) as T;
      
      logger.info(`API request completed in ${Date.now() - startTime}ms`, {
        url,
        status: response.status,
        retryCount
      });
      
      return { data };
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      const shouldRetry = this.shouldRetry(error) && retryCount < MAX_RETRIES;
      
      // Log error details
      const errorContext = {
        url,
        retryCount,
        willRetry: shouldRetry,
      };
      
      if (error instanceof Error) {
        logger.error(`API request failed: ${errorMessage}`, error, errorContext);
      } else {
        logger.error(`API request failed: ${errorMessage}`, new Error(String(error)), errorContext);
      }

      if (shouldRetry) {
        const backoff = 1000 * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.makeRequest<T>(url, options, retryCount + 1);
      }

      return {
        error: {
          message: errorMessage,
          code: error instanceof Error && 'code' in error ? String(error.code) : 'API_ERROR',
        },
      };
    }
  }

  private shouldRetry(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // Retry on network errors, timeouts, and 5xx errors
    return (
      error.name === 'AbortError' || // Timeout
      error.name === 'ECONNRESET' ||
      error.name === 'ECONNREFUSED' ||
      error.name === 'ENOTFOUND' ||
      (error as any).code === 'ETIMEDOUT' ||
      (error as any).code === 'ECONNABORTED' ||
      (error.message.includes('timeout') || 
       error.message.includes('ETIMEDOUT') ||
       error.message.includes('ECONNRESET') ||
       error.message.includes('ECONNREFUSED') ||
       error.message.includes('ENOTFOUND') ||
       error.message.includes('network'))
    );
  }

  private buildUrl(baseUrl: string, params: Record<string, any> = {}): string {
    const url = new URL(baseUrl);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
    
    return url.toString();
  }
}

// Singleton instance
export const apiClient = new ApiClient();
