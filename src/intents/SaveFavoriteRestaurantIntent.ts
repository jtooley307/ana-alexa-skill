import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { preferencesService } from '../services/PreferencesService';
import { logger } from '../utils/logger';

// Using the logger directly since we don't need child logger functionality here

export class SaveFavoriteRestaurantIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'SaveFavoriteRestaurantIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return SaveFavoriteRestaurantIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling SaveFavoriteRestaurantIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const request = handlerInput.requestEnvelope.request;
      
      // Type guard to check if this is an IntentRequest
      if (request.type !== 'IntentRequest' || !request.intent) {
        throw new Error('Invalid request type for SaveFavoriteRestaurantIntent');
      }
      
      const slots = request.intent.slots || {};
      const restaurantName = slots.restaurantName?.value;
      
      if (!restaurantName) {
        return this.handleNoRestaurantName(handlerInput);
      }
      
      logger.info('Saving favorite restaurant', { userId, restaurantName, intent: 'SaveFavoriteRestaurantIntent' });
      
      // Save the favorite restaurant
      await preferencesService.updatePreferences(userId, { favoriteRestaurant: restaurantName });
      
      // Build response
      const speechText = `I've saved ${restaurantName} as your favorite restaurant. I'll keep this in mind for future recommendations.`;
      const cardText = `Favorite restaurant saved: ${restaurantName}`;
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Favorite Restaurant Saved', cardText)
        .withShouldEndSession(false)
        .getResponse();
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  private handleNoRestaurantName(handlerInput: HandlerInput): Response {
    const speechText = "I'm sorry, I didn't catch the name of the restaurant you want to save as your favorite. Please try again.";
    const repromptText = 'You can say something like "Save Olive Garden as my favorite restaurant" or "My favorite restaurant is The Cheesecake Factory"';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Restaurant Name Required', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in SaveFavoriteRestaurantIntent', { 
      error: error.message,
      stack: error.stack,
      intent: 'SaveFavoriteRestaurantIntent'
    });
    
    const speechText = 'I had trouble saving your favorite restaurant. Please try again later.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
