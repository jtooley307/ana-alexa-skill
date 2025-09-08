import { HandlerInput } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { apiClient } from '../services/ApiClient';
import { createLogger } from '../utils/logger';
import { extractDishName, normalizeDishName } from '../utils/stringUtils';

const logger = createLogger('RecommendDishIntent');

export class RecommendDishIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           (request as IntentRequest).intent.name === 'RecommendDishIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return RecommendDishIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling RecommendDishIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const request = handlerInput.requestEnvelope.request as IntentRequest;
      const { slots } = request.intent;
      
      // Get user preferences
      const preferences = await this.getUserPreferences(handlerInput);
      
      // Extract parameters from slots
      const mealType = (slots?.mealType?.value as string) || preferences.preferredMealType || 'dinner';
    const hasExplicitMealType = Boolean(slots?.mealType?.value);
      const cuisine = slots?.cuisine?.value as string | undefined;
      const dishNameRaw = ((slots?.dishName?.value as string) || '').trim();
      const isGeneric = !dishNameRaw || dishNameRaw.toLowerCase() === 'popular';

      // If user didn't specify a concrete dish and no cuisine is provided, ask a clarifying question instead of calling the API
      if (isGeneric && !cuisine) {
        const prompt = "What kind of dish are you in the mood for? For example, chicken, pasta, or salad.";
        // Mark that we are awaiting a dish preference to avoid accidental 'save favorite' routing
        const session = handlerInput.attributesManager.getSessionAttributes();
        handlerInput.attributesManager.setSessionAttributes({
          ...session,
          awaitingDishPreference: true,
        });
        return handlerInput.responseBuilder
          .speak(prompt)
          .reprompt(prompt)
          .withSimpleCard('Dish Preference', prompt)
          .withShouldEndSession(false)
          .getResponse();
      }

      // Construct a more specific query from cuisine/meal type when the request was generic
      const dishName = isGeneric
        ? `${cuisine ? cuisine + ' ' : ''}${mealType}`.trim()
        : dishNameRaw;
      
      // Log the request
      logger.info('Fetching dish recommendation', { userId, mealType, cuisine, dishName });
      
      // Get dish recommendation
      const dish = await this.getDishRecommendation(mealType, dishName, cuisine, hasExplicitMealType);
      
      if (!dish) {
        return this.handleNoDishFound(handlerInput, mealType, cuisine);
      }
      
      // Store the recommended dish in session attributes for potential recipe follow-up and clear prompt flag
      const sessionAfter = handlerInput.attributesManager.getSessionAttributes();
      handlerInput.attributesManager.setSessionAttributes({
        ...sessionAfter,
        awaitingDishPreference: false,
        lastRecommendedDish: dish.dish_name || dish.name || dishName
      });
      
      // Build response
      const speechText = this.buildResponse(dish, mealType);
      const cardText = this.buildCardText(dish, mealType, cuisine);
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Dish Recommendation', cardText)
        .withShouldEndSession(false)
        .getResponse();
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  // getUserPreferences is inherited from BaseHandler
  
  private async getDishRecommendation(mealType: string, dishName: string, cuisine?: string, includeMealTypeFilter: boolean = false): Promise<any> {
    try {
      // Normalize the dish name to remove common food-related words
      const normalizedDishName = normalizeDishName(dishName);
      const extractedDishName = extractDishName(dishName);
      
      // Use the more specific extracted name if available, otherwise use normalized name
      // API expects 'query' param; make it lowercase to improve matching.
      const searchQuery = (extractedDishName || normalizedDishName || dishName).toLowerCase();
      
      const params: any = {
        // Official key used by the API
        query: searchQuery,
        limit: 1,
      };

      // Only include meal_type if the user explicitly provided a mealType in their utterance
      if (includeMealTypeFilter) {
        params.meal_type = mealType;
      }
      
      // Always include cuisine when provided (normalized to lowercase)
      if (cuisine) {
        params.cuisine = cuisine.toLowerCase();
      }
    
      // Intentionally do not include era/time_period to avoid narrowing or latency issues
    
      logger.info('Fetching dish recommendation with params', { params });
      
      let response = await apiClient.getHistoricalDishes(params);
      logger.info('API Response received', { 
        hasData: !!response.data,
        resultCount: (response.data?.results?.length || response.data?.recommendations?.length || 0)
      });
      
      if (response.error) {
        logger.warn('Error from API', { error: response.error });
        return null;
      }
      
      // Check if response has data and results array
      let items = (response.data && (response.data.results || response.data.recommendations)) || [];
      if (!Array.isArray(items) || items.length === 0) {
        logger.warn('No dishes found in response data.results');
        // Fallback: retry with only the core query parameters
        const fallbackParams: any = { query: params.query, limit: params.limit, ...(includeMealTypeFilter ? { meal_type: mealType } : {}), ...(params.cuisine ? { cuisine: params.cuisine } : {}) };
        logger.info('Retrying dish search with fallback params', { fallbackParams });
        response = await apiClient.getHistoricalDishes(fallbackParams);
        logger.info('Fallback API Response received', {
          hasData: !!response.data,
          resultCount: (response.data?.results?.length || response.data?.recommendations?.length || 0)
        });
        items = (response.data && (response.data.results || response.data.recommendations)) || [];
        if (!Array.isArray(items) || items.length === 0) {
          return null;
        }
      }
      
      // Get the first dish
      const dish = items[0];
      logger.info('Found dish', { 
        dishName: dish.dish_name || dish.name,
        cuisineType: dish.cuisine_type || dish.cuisine
      });
      
      // Ensure the dish has at least a name (using dish_name from the API response)
      if (!dish.dish_name && !dish.name) {
        logger.warn('Dish missing name property', { dish });
        return null;
      }
      
      return dish;
    } catch (error) {
      const errorObj = error as Error;
      logger.error('Error in getDishRecommendation', errorObj);
      return null;
    }
  }
  
  private buildResponse(dish: any, mealType: string): string {
    const name = dish.dish_name || dish.name || 'a delicious dish';
    // Clean up markdown formatting if present; preserve original casing for speech naturalness
    const cleanDescription = (dish.description || '')
      .toString()
      .replace(/\*\*/g, '')
      .trim();

    let speechText = `For ${mealType}, I recommend ${name}`;

    if (cleanDescription) {
      // Ensure description ends with a period
      const desc = /[.!?]$/.test(cleanDescription) ? cleanDescription : `${cleanDescription}.`;
      speechText += `, which is ${desc}`;
    }

    speechText += ' Would you like me to get the recipe for this dish, find a restaurant that serves it, or recommend something else?';
    return speechText;
  }
  
  private buildCardText(dish: any, mealType: string, cuisine?: string): string {
    let cardText = `Recommended ${mealType} dish:\n\n`;
    
    // Use dish_name from the API response, or fallback to name
    if (dish.dish_name || dish.name) {
      cardText += `Name: ${dish.dish_name || dish.name}\n\n`;
    }
    
    // Use description from the API response
    if (dish.description) {
      // Clean up markdown formatting if present
      const cleanDescription = dish.description.replace(/\*\*/g, '');
      cardText += `Description: ${cleanDescription}\n\n`;
    }
    
    // Use cuisine_type from the API response if available, otherwise use the provided cuisine
    if (dish.cuisine_type) {
      cardText += `Cuisine: ${dish.cuisine_type}\n\n`;
    } else if (cuisine) {
      cardText += `Cuisine: ${cuisine}\n\n`;
    }
    
    // Handle ingredients if present
    if (dish.ingredients) {
      // Handle both string and array formats for ingredients
      const ingredients = typeof dish.ingredients === 'string' 
        ? dish.ingredients 
        : Array.isArray(dish.ingredients) 
          ? dish.ingredients.join(', ')
          : '';
      cardText += `Ingredients: ${ingredients}\n\n`;
    }
    
    return cardText.trim();
  }
  
  private handleNoDishFound(handlerInput: HandlerInput, mealType: string, cuisine?: string): Response {
    let speechText = `I'm sorry, I couldn't find any ${cuisine ? `${cuisine} ` : ''}dishes for ${mealType}. `;
    speechText += 'Would you like to try a different cuisine or meal type?';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('You can say something like, "Find me an Italian dish" or "Recommend something for lunch"')
      .withSimpleCard('No Dishes Found', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in RecommendDishIntent', error);
    
    const speechText = 'I had trouble finding a dish recommendation. Please try again later.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
