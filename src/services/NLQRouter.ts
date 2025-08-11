import { HandlerInput } from 'ask-sdk-core';
import { createLogger } from '../utils/logger';
import { bedrockService, ExtractedEntities } from './BedrockService';

const logger = createLogger('nlq-router');

export type NLQAction = 'RecommendMeal' | 'RecommendDish' | 'RecommendRestaurant' | 'Unknown';

export interface NLQResult {
  action: NLQAction;
  entities: ExtractedEntities;
}

export class NLQRouter {
  private readonly cuisineKeywords: string[] = [
    'italian', 'chinese', 'mexican', 'indian', 'thai', 'japanese', 'french',
    'mediterranean', 'greek', 'spanish', 'korean', 'vietnamese', 'american',
    'bbq', 'barbecue', 'steakhouse', 'seafood', 'sushi', 'vegetarian', 'vegan',
    'gluten free', 'healthy', 'fast food', 'pizza', 'burger', 'sandwich', 'salad',
    'dessert', 'bakery', 'cafe', 'coffee', 'breakfast', 'brunch', 'diner'
  ];

  private readonly mealTypeMap: Record<string, 'breakfast' | 'lunch' | 'dinner'> = {
    'breakfast': 'breakfast',
    'brunch': 'breakfast',
    'morning': 'breakfast',
    'lunch': 'lunch',
    'afternoon': 'lunch',
    'dinner': 'dinner',
    'evening': 'dinner',
    'night': 'dinner',
    'supper': 'dinner',
  };

  /**
   * Process a natural language query and determine the appropriate action
   * @param query The user's natural language query
   * @param handlerInput Optional handler input for additional context
   * @returns NLQResult containing the action and extracted entities
   */
  async processQuery(query: string, _handlerInput?: HandlerInput): Promise<NLQResult> {
    const normalizedQuery = query.trim();
    // Remove unused result variable since we return directly

    try {
      // First try to use Bedrock for advanced entity extraction
      const bedrockResult = await this.processWithBedrock(normalizedQuery);
      
      if (bedrockResult.action !== 'Unknown') {
        // If Bedrock found a clear intent, use its results
        return bedrockResult;
      }
      
      // Fall back to rule-based extraction if Bedrock wasn't confident
      return this.processWithRules(normalizedQuery);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in processQuery: ${errorMessage} [query: ${query}]`);
      // Fall back to rule-based processing if Bedrock fails
      return this.processWithRules(normalizedQuery);
    }
  }

  /**
   * Process query using Bedrock for advanced entity extraction
   */
  private async processWithBedrock(query: string): Promise<NLQResult> {
    try {
      const entities = await bedrockService.extractEntities(query);
      
      const result: NLQResult = {
        action: entities.intent || 'Unknown',
        entities: { ...entities }
      };
      
      logger.info('Processed with Bedrock', { query, result });
      return result;
      
    } catch (error) {
      logger.warn('Error processing with Bedrock, falling back to rules', { error, query });
      return this.processWithRules(query);
    }
  }
  
  /**
   * Fallback rule-based processing
   */
  private processWithRules(query: string): NLQResult {
    const normalizedQuery = query.toLowerCase().trim();
    const result: NLQResult = {
      action: 'Unknown',
      entities: {},
    };
    
    // Extract meal type
    for (const [term, mealType] of Object.entries(this.mealTypeMap)) {
      if (normalizedQuery.includes(term)) {
        result.entities.mealType = mealType;
        break;
      }
    }

    // Extract cuisine
    for (const cuisine of this.cuisineKeywords) {
      if (normalizedQuery.includes(cuisine)) {
        result.entities.cuisine = cuisine;
        break;
      }
    }

    // Extract location (simple pattern match for now)
    const locationMatch = normalizedQuery.match(/(?:in|near|around|at|close to|by) ([\w\s]+)$/i);
    if (locationMatch && locationMatch[1]) {
      result.entities.location = locationMatch[1].trim();
    }

    // Extract budget and quick flags
    result.entities.budget = /\b(cheap|affordable|inexpensive|budget|low cost)\b/i.test(normalizedQuery);
    result.entities.quick = /\b(quick|fast|quickly|in a hurry|right away|asap|fast food|fast-food)\b/i.test(normalizedQuery);

    // Determine action based on query patterns
    if (this.isRestaurantQuery(normalizedQuery)) {
      result.action = 'RecommendRestaurant';
    } else if (this.isMealQuery(normalizedQuery)) {
      result.action = 'RecommendMeal';
    } else if (this.isDishQuery(normalizedQuery)) {
      result.action = 'RecommendDish';
      // Try to extract dish name if it's a specific dish query
      const dishMatch = normalizedQuery.match(/\b(?:recommend|suggest|find|get|what'?s|what is|what are|what would you recommend for|what should i have for|what should i eat for)?\s*([\w\s]+?)(?:\?|$)/i);
      if (dishMatch && dishMatch[1]) {
        const potentialDish = dishMatch[1].trim();
        // Only use if it's not a meal type or other keyword
        if (!this.mealTypeMap[potentialDish.toLowerCase()] && 
            !this.cuisineKeywords.includes(potentialDish.toLowerCase())) {
          result.entities.dishName = potentialDish;
        }
      }
    }

    // If we couldn't determine an action but have a meal type, default to RecommendMeal
    if (result.action === 'Unknown' && result.entities.mealType) {
      result.action = 'RecommendMeal';
    }
    
    logger.info('Processed with rules', { query, result });
    return result;
  }

  private isRestaurantQuery(query: string): boolean {
    const restaurantKeywords = [
      'restaurant', 'place to eat', 'eatery', 'dining', 'cafe', 'bistro',
      'where can i eat', 'find me a place', 'food place', 'eat out',
      'dine out', 'food spot', 'food joint', 'restaurants'
    ];
    return restaurantKeywords.some(keyword => query.includes(keyword));
  }

  private isMealQuery(query: string): boolean {
    const mealKeywords = [
      'what should i eat', 'what to eat', 'what should i have',
      'what do you recommend', 'suggest something', 'recommend something',
      'what\'s good', 'whats good', 'what\'s for', 'whats for',
      'i\'m hungry', 'im hungry', 'i am hungry', 'i need to eat',
      'i want to eat', 'i feel like', 'i\'m in the mood for', 'im in the mood for'
    ];
    
    return mealKeywords.some(keyword => query.includes(keyword)) || 
           Object.keys(this.mealTypeMap).some(mealTerm => query.includes(mealTerm));
  }

  private isDishQuery(query: string): boolean {
    const dishKeywords = [
      'dish', 'recipe', 'food item', 'what is', 'what are',
      'tell me about', 'what do you know about', 'what can you tell me about'
    ];
    
    return dishKeywords.some(keyword => query.includes(keyword)) ||
           (query.split(' ').length <= 5 && !this.isMealQuery(query) && !this.isRestaurantQuery(query));
  }
}

// Singleton instance
export const nlqRouter = new NLQRouter();
