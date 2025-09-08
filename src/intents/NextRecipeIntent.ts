import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';

export class NextRecipeIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const req: any = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' && req.intent?.name === 'NextRecipeIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return NextRecipeIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling NextRecipeIntent');

    const sessionAttrs: any = handlerInput.attributesManager.getSessionAttributes() || {};
    const recs: any[] = sessionAttrs.recipeRecommendations || [];
    let index: number = typeof sessionAttrs.recipeIndex === 'number' ? sessionAttrs.recipeIndex : -1;

    if (!Array.isArray(recs) || recs.length === 0) {
      const speech = "I don't have more recipes saved yet. Ask me for a recipe, for example: get the recipe for chicken curry.";
      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('You can say: get the recipe for ramen, or recommend a dish.')
        .withShouldEndSession(false)
        .getResponse();
    }

    index = index + 1;
    if (index >= recs.length) {
      const speech = 'Those are all the recipes I found. Would you like me to search again or try a different dish?';
      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('You can say: get the recipe for pasta, or recommend a dish.')
        .withShouldEndSession(false)
        .getResponse();
    }

    const r = recs[index] || {};
    sessionAttrs.recipeIndex = index;
    handlerInput.attributesManager.setSessionAttributes(sessionAttrs);

    const name = r.name || r.title || 'another recipe';
    const speech = `Another recipe is ${name}. Would you like another option? You can say, next recipe.`;

    const cardLines: string[] = [];
    cardLines.push(name);
    if (r.description || r.summary) cardLines.push('', (r.description || r.summary));
    if (Array.isArray(r.ingredients) && r.ingredients.length) {
      cardLines.push('', 'INGREDIENTS:');
      for (const ing of r.ingredients.slice(0, 8)) {
        const txt = typeof ing === 'string' ? ing : (ing.ingredient_text || ing.normalized_ingredient || ing.name || '');
        if (txt) cardLines.push(`• ${txt}`);
      }
    }

    return handlerInput.responseBuilder
      .speak(speech)
      .withSimpleCard('Recipe Recommendation', cardLines.join('\n'))
      .reprompt('Say next recipe for another option, or ask me to find a restaurant that serves it.')
      .getResponse();
  }
}
