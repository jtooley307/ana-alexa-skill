import { logger } from '../utils/logger';
import { apiClient } from './ApiClient';

export interface MealRecommendation {
  name: string;
  description: string;
  courses: {
    type: string;
    name: string;
    description: string;
  }[];
  dietaryRestrictions?: string[];
}

export interface MealSearchOptions {
  query: string;
  cuisine?: string;
  meal_type?: string; // breakfast|lunch|dinner|brunch|snack
  limit?: number; // 1-10
}

export const recommendMeal = async (
  _preferences: Record<string, any> = {},
  options: MealSearchOptions
): Promise<MealRecommendation> => {
  try {
    const query = options.query?.toString().trim();
    if (!query) {
      throw new Error('MealService: query is required');
    }

    const payload = {
      query,
      limit: Math.min(Math.max(options.limit ?? 3, 1), 10),
      cuisine: options.cuisine?.toLowerCase(),
      meal_type: options.meal_type,
    };

    logger.info('MealService: posting to Meals API', { payload });
    const response = await apiClient.postMeals(payload);

    if (response.error) {
      logger.warn('MealService: API error', { error: response.error });
      throw new Error(response.error.message);
    }

    const results = (response.data && (response.data as any).results) || [];
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('No meal results');
    }

    const meal = results[0];
    // Map meal composition to our recommendation shape
    const courses: MealRecommendation['courses'] = [];
    const comps = meal.components || {};
    const pushComp = (type: string, comp: any) => {
      if (!comp) return;
      courses.push({
        type,
        name: comp.name || comp.dish_name || comp.title || 'Unknown',
        description: comp.description || comp.summary || '',
      });
    };
    // Handle possible shapes: entree, sides (array), appetizer, dessert, drink, etc.
    pushComp('entree', comps.entree);
    if (Array.isArray(comps.sides)) {
      comps.sides.forEach((s: any) => pushComp('side', s));
    } else if (comps.side) {
      pushComp('side', comps.side);
    }
    pushComp('appetizer', comps.appetizer);
    pushComp('dessert', comps.dessert);
    pushComp('drink', comps.drink);

    // Generic pass: include any other component keys present (e.g., 'starter', 'course1', etc.)
    Object.keys(comps || {}).forEach((key) => {
      if (['entree','main','side','sides','appetizer','dessert','drink'].includes(key)) return; // already handled
      const val = (comps as any)[key];
      if (Array.isArray(val)) {
        val.forEach((comp: any) => pushComp(key, comp));
      } else if (typeof val === 'object') {
        pushComp(key, val);
      }
    });

    const name = meal.name || `${payload.cuisine ? payload.cuisine + ' ' : ''}${payload.meal_type || 'meal'}`;
    const description = `A composed ${payload.meal_type || 'meal'} with ${courses.map(c => c.name).join(', ')}`;

    return {
      name,
      description,
      courses,
    };
  } catch (error) {
    logger.error('Error in recommendMeal:', error as Error);
    throw error;
  }
};

export const getMealPlan = async (mealType: string, preferences: Record<string, any> = {}): Promise<MealRecommendation> => {
  return recommendMeal(preferences, { query: `${mealType} meal`, meal_type: mealType, limit: 3 });
};
