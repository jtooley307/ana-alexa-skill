import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';

export class NextRestaurantIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const req: any = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' && req.intent?.name === 'NextRestaurantIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return NextRestaurantIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling NextRestaurantIntent');

    const sessionAttrs: any = handlerInput.attributesManager.getSessionAttributes() || {};
    const recs: any[] = sessionAttrs.restaurantRecommendations || [];
    let index: number = typeof sessionAttrs.restaurantIndex === 'number' ? sessionAttrs.restaurantIndex : -1;

    if (!Array.isArray(recs) || recs.length === 0) {
      const speech = 'I don\'t have more restaurant options saved yet. You can say, recommend a restaurant for ramen.';
      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Ask me to recommend a restaurant for a dish, for example: chicken tikka masala.')
        .withShouldEndSession(false)
        .getResponse();
    }

    // Move to next item
    index = index + 1;
    if (index >= recs.length) {
      const speech = 'Those are all the options I have right now. Would you like me to search again or pick a different dish?';
      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('You can say, search again, or recommend a restaurant for sushi.')
        .withShouldEndSession(false)
        .getResponse();
    }

    const r = recs[index] || {};
    sessionAttrs.restaurantIndex = index;
    handlerInput.attributesManager.setSessionAttributes(sessionAttrs);

    const speech = `Another option is ${r.name}, a ${r.cuisine || 'restaurant'}. It's located at ${r.address}. ` +
      'Would you like another option? You can say, next.';

    const card = `${r.name}\n\n`+
      (r.cuisine ? `Cuisine: ${r.cuisine}\n` : '') +
      (r.address ? `Address: ${r.address}\n` : '') +
      (r.rating ? `Rating: ${r.rating}/5\n` : '') +
      (r.priceRange ? `Price Range: ${r.priceRange}\n` : '');

    return handlerInput.responseBuilder
      .speak(speech)
      .withSimpleCard('Restaurant Recommendation', card.trim())
      .reprompt('Say next for another restaurant option, or say details to hear more.')
      .getResponse();
  }
}
