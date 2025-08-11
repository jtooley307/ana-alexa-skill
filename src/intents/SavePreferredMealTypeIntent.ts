import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { preferencesService } from '../services/PreferencesService';
import { createLogger } from '../utils/logger';

const logger = createLogger('SavePreferredMealTypeIntent');

type MealType = 'breakfast' | 'lunch' | 'dinner';

export class SavePreferredMealTypeIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'SavePreferredMealTypeIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return SavePreferredMealTypeIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling SavePreferredMealTypeIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const { slots } = handlerInput.requestEnvelope.request.intent;
      const mealType = slots?.mealType?.value?.toLowerCase() as MealType | undefined;
      
      if (!mealType || !this.isValidMealType(mealType)) {
        return this.handleInvalidMealType(handlerInput, mealType);
      }
      
      logger.info('Saving preferred meal type', { userId, mealType });
      
      // Save the preferred meal type
      await preferencesService.updatePreferences(userId, { preferredMealType: mealType });
      
      // Build response
      const article = ['a', 'e', 'i', 'o', 'u'].includes(mealType[0]) ? 'an' : 'a';
      const speechText = `I've saved your preference for ${article} ${mealType} meal. I'll keep this in mind for future recommendations.`;
      const cardText = `Preferred meal type saved: ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`;
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Meal Preference Saved', cardText)
        .withShouldEndSession(false)
        .getResponse();
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  private isValidMealType(mealType: string | undefined): mealType is MealType {
    return mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner';
  }
  
  private handleInvalidMealType(handlerInput: HandlerInput, mealType: string | undefined): Response {
    logger.warn('Invalid meal type provided', { mealType });
    
    const speechText = `I'm sorry, "${mealType || 'that'}" doesn't seem to be a valid meal type. ` +
      'You can choose from breakfast, lunch, or dinner. Which would you prefer?';
      
    const repromptText = 'Please say breakfast, lunch, or dinner.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Invalid Meal Type', 'Please choose from breakfast, lunch, or dinner')
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in SavePreferredMealTypeIntent', error);
    
    const speechText = 'I had trouble saving your meal preference. Please try again later.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
