import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { NextRestaurantIntentHandler } from './NextRestaurantIntent';
import { NextRecipeIntentHandler } from './NextRecipeIntent';

export class NextOptionIntentHandler extends BaseHandler {
  static matches(handlerInput: HandlerInput): boolean {
    const req: any = handlerInput.requestEnvelope.request;
    if (req.type !== 'IntentRequest') return false;
    const name = req.intent?.name;
    return name === 'NextRestaurantIntent' || name === 'NextRecipeIntent' || name === 'AMAZON.NextIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return NextOptionIntentHandler.matches(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling NextOptionIntent');

    const session: any = handlerInput.attributesManager.getSessionAttributes() || {};
    const hasRestaurants = Array.isArray(session.restaurantRecommendations) && session.restaurantRecommendations.length > 0;
    const hasRecipes = Array.isArray(session.recipeRecommendations) && session.recipeRecommendations.length > 0;

    if (hasRestaurants) {
      return new NextRestaurantIntentHandler().handle(handlerInput);
    }

    if (hasRecipes) {
      return new NextRecipeIntentHandler().handle(handlerInput);
    }

    return handlerInput.responseBuilder
      .speak("I don't have anything to go next on yet. Ask me to recommend a restaurant or a recipe first.")
      .reprompt('You can say: recommend a restaurant for ramen, or get the recipe for chicken curry.')
      .withShouldEndSession(false)
      .getResponse();
  }
}
