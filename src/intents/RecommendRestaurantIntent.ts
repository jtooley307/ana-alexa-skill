import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { recommendRestaurant } from '../services/RestaurantService';
import { BaseHandler } from '../handlers/BaseHandler';

export class RecommendRestaurantIntentHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent?.name === 'RecommendRestaurantIntent';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    try {
      this.logRequest(handlerInput, 'Handling RecommendRestaurantIntent');
      
      // Get user preferences
      const preferences = await this.getUserPreferences(handlerInput);
      
      // Get restaurant recommendation
      const restaurant = await recommendRestaurant(preferences);
      
      // Format the response
      const speechText = `I recommend ${restaurant.name}, a ${restaurant.cuisine} restaurant. ` +
        `It's located at ${restaurant.address}.`;
      
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard(
          'Restaurant Recommendation',
          `${restaurant.name}\n\n` +
          `Cuisine: ${restaurant.cuisine}\n` +
          `Address: ${restaurant.address}\n` +
          (restaurant.rating ? `Rating: ${restaurant.rating}/5\n` : '') +
          (restaurant.priceRange ? `Price Range: ${restaurant.priceRange}\n` : '') +
          (restaurant.dietaryOptions?.length ? 
            `\nDietary Options: ${restaurant.dietaryOptions.join(', ')}` : '')
        )
        .getResponse();
    } catch (error) {
      this.logError(error, handlerInput);
      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble finding a restaurant recommendation. Please try again later.')
        .getResponse();
    }
  }
}
