import { logger } from '../utils/logger';
import { apiClient } from './ApiClient';

export interface RestaurantRecommendation {
  name: string;
  cuisine: string;
  address: string;
  rating?: number;
  priceRange?: string;
  dietaryOptions?: string[];
}

export interface RestaurantSearchOptions {
  dish?: string; // preferred key per API (alias of query)
  query?: string; // fallback alias
  limit?: number; // default 5
  use_bedrock?: boolean | string; // default true
}

export const recommendRestaurant = async (
  _preferences: Record<string, any> = {},
  options: RestaurantSearchOptions = {}
): Promise<RestaurantRecommendation> => {
  try {
    const dish = (options.dish || options.query || '').toString().trim();
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
    const use_bedrock = options.use_bedrock ?? true;

    if (!dish) {
      throw new Error('RestaurantService: dish (or query) is required');
    }

    const params = {
      dish,
      limit,
      use_bedrock: typeof use_bedrock === 'boolean' ? String(use_bedrock) : use_bedrock,
    };

    logger.info('RestaurantService: fetching recommendations', { params });
    const response = await apiClient.getRestaurants(params);

    if (response.error) {
      logger.warn('RestaurantService: API error', { error: response.error });
      throw new Error(response.error.message);
    }

    // Debug logging of response shape to aid troubleshooting
    try {
      const dbg = response.data as any;
      logger.info('RestaurantService: raw response shape', {
        type: Array.isArray(dbg) ? 'array' : typeof dbg,
        keys: dbg && !Array.isArray(dbg) ? Object.keys(dbg) : undefined,
        nestedDataKeys: dbg?.data && typeof dbg.data === 'object' ? Object.keys(dbg.data) : undefined,
      });
    } catch {}

    // Normalize possible response shapes
    const d = response.data as any;
    let recs: any[] = [];
    if (Array.isArray(d)) {
      recs = d;
    } else if (d?.recommendations && Array.isArray(d.recommendations)) {
      recs = d.recommendations;
    } else if (d?.results && Array.isArray(d.results)) {
      recs = d.results;
    } else if (d?.restaurants && Array.isArray(d.restaurants)) {
      recs = d.restaurants;
    } else if (d?.data?.recommendations && Array.isArray(d.data.recommendations)) {
      recs = d.data.recommendations;
    } else if (d?.data?.results && Array.isArray(d.data.results)) {
      recs = d.data.results;
    } else if (d?.data?.restaurants && Array.isArray(d.data.restaurants)) {
      recs = d.data.restaurants;
    } else if (d?.data && Array.isArray(d.data)) {
      // Case: { success: true, data: [ ... ], ... }
      recs = d.data;
    }

    if (!Array.isArray(recs) || recs.length === 0) {
      throw new Error('No restaurant recommendations found');
    }

    // Map the first recommendation to our shape; attempt to read common fields
    const r = recs[0] || {};
    // Log first item keys to ensure mapping stays aligned
    try {
      logger.info('RestaurantService: first recommendation keys', { keys: Object.keys(r || {}) });
    } catch {}
    const mapped: RestaurantRecommendation = {
      name: r.name || r.title || r.business_name || 'Recommended Restaurant',
      cuisine: r.cuisine || r.cuisine_type || r.category || 'Unknown',
      address: r.address || r.location || r.formatted_address || 'Address not available',
      rating: r.rating || r.score || r.stars,
      priceRange: r.price_range || r.priceRange || r.price,
      dietaryOptions: r.dietary_options || r.dietaryOptions || r.diet || undefined,
    };

    return mapped;
  } catch (error) {
    logger.error('Error in recommendRestaurant:', error as Error);
    throw error;
  }
};

export const getRestaurantDetails = async (_restaurantId: string): Promise<RestaurantRecommendation> => {
  // Mock implementation
  return recommendRestaurant();
};

export const listRestaurantRecommendations = async (
  _preferences: Record<string, any> = {},
  options: RestaurantSearchOptions = {}
): Promise<RestaurantRecommendation[]> => {
  const one = await recommendRestaurant(_preferences, options);
  try {
    const dish = (options.dish || options.query || '').toString().trim();
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
    const use_bedrock = options.use_bedrock ?? true;
    const params = {
      dish,
      limit,
      use_bedrock: typeof use_bedrock === 'boolean' ? String(use_bedrock) : use_bedrock,
    } as any;
    const response = await apiClient.getRestaurants(params);
    if (response.error) throw new Error(response.error.message);
    const d = response.data as any;
    let recs: any[] = [];
    if (Array.isArray(d)) recs = d;
    else if (Array.isArray(d?.recommendations)) recs = d.recommendations;
    else if (Array.isArray(d?.results)) recs = d.results;
    else if (Array.isArray(d?.restaurants)) recs = d.restaurants;
    else if (Array.isArray(d?.data?.recommendations)) recs = d.data.recommendations;
    else if (Array.isArray(d?.data?.results)) recs = d.data.results;
    else if (Array.isArray(d?.data?.restaurants)) recs = d.data.restaurants;
    else if (Array.isArray(d?.data)) recs = d.data;
    if (!recs.length) return [one].filter(Boolean) as RestaurantRecommendation[];
    const mapped = recs.map((r: any) => ({
      name: r.name || r.title || r.business_name || 'Recommended Restaurant',
      cuisine: r.cuisine || r.cuisine_type || r.category || 'Unknown',
      address: r.address || r.location || r.formatted_address || 'Address not available',
      rating: r.rating || r.score || r.stars,
      priceRange: r.price_range || r.priceRange || r.price,
      dietaryOptions: r.dietary_options || r.dietaryOptions || r.diet || undefined,
    } as RestaurantRecommendation));
    return mapped.slice(0, limit);
  } catch (e) {
    logger.warn('RestaurantService: list fallback to single due to error', { error: (e as Error).message });
    return [one].filter(Boolean) as RestaurantRecommendation[];
  }
};
