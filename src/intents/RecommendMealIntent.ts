import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { recommendMeal } from '../services/MealService';
import { BaseHandler } from '../handlers/BaseHandler';

export class RecommendMealIntentHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent?.name === 'RecommendMealIntent';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    try {
      this.logRequest(handlerInput, 'Handling RecommendMealIntent');
      
      // Get user preferences
      const preferences = await this.getUserPreferences(handlerInput);
      
      // Get meal recommendation
      const meal = await recommendMeal(preferences);
      
      // Format the response
      const speechText = `I recommend ${meal.name}. ${meal.description}. ` +
        `It includes: ${meal.courses.map((c) => c.name).join(', ')}.`;
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Meal Recommendation', 
          `${meal.name}\n\n` +
          `${meal.description}\n\n` +
          `Includes: ${meal.courses.map((c) => c.name).join(', ')}\n` +
          (meal.dietaryRestrictions?.length ? 
            `\nDietary notes: ${meal.dietaryRestrictions.join(', ')}` : '')
        )
        .getResponse();
    } catch (error) {
      this.logError(error, handlerInput);
      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble finding a meal recommendation. Please try again later.')
        .getResponse();
    }
  }
}
