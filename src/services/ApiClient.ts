import { fetch } from 'undici';
import { AbortController } from 'node-abort-controller';
import { createLogger } from '../utils/logger';

const logger = createLogger('api-client');

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const ENV_MAX_RETRIES = parseInt(process.env.API_MAX_RETRIES || '1', 10);

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
  // Preferred key per Restaurant API spec
  dish?: string;
  // Alias maintained for backward compatibility
  query?: string;
  location?: string;
  limit?: number;
  use_bedrock?: string | boolean;
}

export interface RecipeParams {
  dish?: string;
  // Alias supported by Recipe API
  dish_name?: string;
  limit?: number;
  // Additional params per API spec
  dish_id?: number | string;
  dishId?: number | string;
  recipe_id?: string;
  recipeId?: string;
  action?: string; // e.g., 'describe'
}

export interface MealsParams {
  query: string;
  limit?: number; // 1-10
  cuisine?: string;
  meal_type?: string; // breakfast|lunch|dinner|brunch|snack
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
  private mealsConfig: Required<ApiConfig>;

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

    this.mealsConfig = {
      baseUrl: (process.env.MEALS_API_BASE || 'https://7ots4tpdj1.execute-api.us-west-2.amazonaws.com/prod/meals').trim(),
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

  public async describeRecipe(recipeId: string): Promise<ApiResponse<any>> {
    const url = this.buildUrl(this.recipesConfig.baseUrl, { action: 'describe', recipe_id: recipeId });
    return this.makeRequest(url);
  }

  // Try fetching a single recipe by ID. First attempt path style /:id, then query param ?id=
  public async getRecipeById(id: string): Promise<ApiResponse<any>> {
    const base = this.recipesConfig.baseUrl.replace(/\/$/, '');
    // Attempt 1: /recipes/{id}
    let url = `${base}/${encodeURIComponent(id)}`;
    let resp = await this.makeRequest(url);
    if (resp?.data) return resp;
    // Attempt 2: /recipes?id={id}
    url = this.buildUrl(this.recipesConfig.baseUrl, { id });
    return this.makeRequest(url);
  }

  public async postMeals(params: MealsParams): Promise<ApiResponse<any>> {
    const url = this.mealsConfig.baseUrl; // POST expects JSON body
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  private getTimeoutForUrl(url: string): number {
    try {
      if (url.startsWith(this.historicalDishesConfig.baseUrl)) return this.historicalDishesConfig.timeout;
      if (url.startsWith(this.restaurantsConfig.baseUrl)) return this.restaurantsConfig.timeout;
      if (url.startsWith(this.recipesConfig.baseUrl)) return this.recipesConfig.timeout;
      if (url.startsWith(this.mealsConfig.baseUrl)) return this.mealsConfig.timeout;
    } catch (_) {
      // noop
    }
    return parseInt(process.env.API_TIMEOUT_MS || DEFAULT_TIMEOUT.toString(), 10);
  }

  private async makeRequest<T>(
    url: string,
    options: any = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = this.getTimeoutForUrl(url);
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
      const shouldRetry = this.shouldRetry(error) && retryCount < ENV_MAX_RETRIES;
      
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
