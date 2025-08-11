import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { apiClient } from '../services/ApiClient';
import { preferencesService, UserPreferences } from '../services/PreferencesService';
import { createLogger } from '../utils/logger';
import { extractDishName, normalizeDishName } from '../utils/stringUtils';

const logger = createLogger('RecommendDishIntent');

export class RecommendDishIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'RecommendDishIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return RecommendDishIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling RecommendDishIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const { slots } = handlerInput.requestEnvelope.request.intent;
      
      // Get user preferences
      const preferences = await this.getUserPreferences(handlerInput);
      
      // Extract parameters from slots
      const mealType = (slots?.mealType?.value as string) || preferences.preferredMealType || 'dinner';
      const cuisine = slots?.cuisine?.value as string | undefined;
      const dishName = (slots?.dishName?.value as string) || 'popular';
      
      // Log the request
      logger.info('Fetching dish recommendation', { userId, mealType, cuisine, dishName });
      
      // Get dish recommendation
      const dish = await this.getDishRecommendation(mealType, dishName, cuisine);
      
      if (!dish) {
        return this.handleNoDishFound(handlerInput, mealType, cuisine);
      }
      
      // Build response
      const speechText = this.buildResponse(dish, mealType, cuisine);
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
  
  private async getDishRecommendation(mealType: string, dishName: string, cuisine?: string): Promise<any> {
    try {
      // Normalize the dish name to remove common food-related words
      const normalizedDishName = normalizeDishName(dishName);
      const extractedDishName = extractDishName(dishName);
      
      // Use the more specific extracted name if available, otherwise use normalized name
      const searchQuery = extractedDishName || normalizedDishName || dishName;
      
      const params: any = {
        query: searchQuery,
        era: 'modern', // Default to modern dishes
        limit: 1,
      };
      
      // Only include cuisine as a filter if it's explicitly provided and different from the dish name
      if (cuisine && cuisine.toLowerCase() !== searchQuery.toLowerCase()) {
        params.cuisine = cuisine;
      }
    
      // Map meal type to appropriate era if needed
      if (mealType === 'breakfast') {
        params.era = 'modern';
      } else if (mealType === 'lunch') {
        params.era = 'modern';
      }
    
      logger.info('Fetching dish recommendation with params', { params });
      
      const response = await apiClient.getHistoricalDishes(params);
      logger.info('API Response received', { 
        hasData: !!response.data,
        resultCount: response.data?.results?.length || 0
      });
      
      if (response.error) {
        logger.warn('Error from API', { error: response.error });
        return null;
      }
      
      // Check if response has data and results array
      if (!response.data || !response.data.results || !Array.isArray(response.data.results) || response.data.results.length === 0) {
        logger.warn('No dishes found in response data.results');
        return null;
      }
      
      // Get the first dish
      const dish = response.data.results[0];
      logger.info('Found dish', { 
        dishName: dish.dish_name,
        cuisineType: dish.cuisine_type 
      });
      
      // Ensure the dish has at least a name (using dish_name from the API response)
      if (!dish.dish_name) {
        logger.warn('Dish missing name property', { dish });
        return null;
      }
      
      return dish;
    } catch (error) {
      const errorObj = error as Error;
      logger.error('Error in getDishRecommendation', { 
        error: errorObj.message,
        stack: errorObj.stack 
      });
      return null;
    }
  }
  
  private buildResponse(dish: any, mealType: string, cuisine?: string): string {
    let speechText = `For ${mealType}, I recommend `;
    
    if (dish.dish_name) {
      speechText += `${dish.dish_name}`;
    } else {
      speechText += `a delicious dish`;
    }
    
    // Use description from the API response
    if (dish.description) {
      // Clean up markdown formatting if present
      const cleanDescription = dish.description.replace(/\*\*/g, '');
      speechText += `, which is ${cleanDescription.toLowerCase()}`;
    }
    
    // Use cuisine_type from the API response if available, otherwise use the provided cuisine
    if (dish.cuisine_type) {
      speechText += ` from ${dish.cuisine_type} cuisine`;
    } else if (cuisine) {
      speechText += ` from ${cuisine} cuisine`;
    }
    
    speechText += '. Would you like to know more about this dish or find a restaurant that serves it?';
    
    return speechText;
  }
  
  private buildCardText(dish: any, mealType: string, cuisine?: string): string {
    let cardText = `Recommended ${mealType} dish:\n\n`;
    
    // Use dish_name from the API response
    if (dish.dish_name) {
      cardText += `Name: ${dish.dish_name}\n\n`;
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
