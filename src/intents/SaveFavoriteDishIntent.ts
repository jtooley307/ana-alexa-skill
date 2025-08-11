import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { preferencesService } from '../services/PreferencesService';
import { createLogger } from '../utils/logger';

const logger = createLogger('SaveFavoriteDishIntent');

export class SaveFavoriteDishIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'SaveFavoriteDishIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return SaveFavoriteDishIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling SaveFavoriteDishIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const request = handlerInput.requestEnvelope.request;
      
      // Type guard to check if this is an IntentRequest
      if (request.type !== 'IntentRequest' || !request.intent) {
        throw new Error('Invalid request type for SaveFavoriteDishIntent');
      }
      
      const slots = request.intent.slots || {};
      const dishName = slots.dishName?.value;
      
      if (!dishName) {
        return this.handleNoDishName(handlerInput);
      }
      
      logger.info('Saving favorite dish', { 
        userId, 
        dishName,
        intent: 'SaveFavoriteDishIntent' 
      });
      
      // Save the favorite dish - pass as a string to match UserPreferences interface
      await preferencesService.updatePreferences(userId, { favoriteDish: dishName });
      
      // Build response
      const speechText = `I've saved ${dishName} as your favorite dish. You can ask me to recommend similar dishes anytime.`;
      const cardText = `Favorite dish saved: ${dishName}`;
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Favorite Dish Saved', cardText)
        .withShouldEndSession(false)
        .getResponse();
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  private handleNoDishName(handlerInput: HandlerInput): Response {
    const speechText = "I'm sorry, I didn't catch the name of the dish you want to save as your favorite. Please try again.";
    const repromptText = 'You can say something like "Save pizza as my favorite dish" or "My favorite dish is lasagna"';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Dish Name Required', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in SaveFavoriteDishIntent', error, {
      intent: 'SaveFavoriteDishIntent',
      requestId: handlerInput.requestEnvelope.request.requestId,
      userId: handlerInput.requestEnvelope.session?.user?.userId || 'unknown'
    });
    
    const speechText = 'I had trouble saving your favorite dish. Please try again later.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
