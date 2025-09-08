import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';

export class GetPreferencesIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request as any;
    return request.type === 'IntentRequest' && request.intent?.name === 'GetPreferencesIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return GetPreferencesIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling GetPreferencesIntent');
    try {
      const userId = this.getUserId(handlerInput);
      const prefs = await this.preferencesService.getPreferences(userId);

      const favDish = (prefs as any)?.favoriteDish;
      const favCuisine = (prefs as any)?.favoriteCuisine;
      const mealType = (prefs as any)?.preferredMealType || (prefs as any)?.mealType;

      let lines: string[] = [];
      if (favDish) lines.push(`Favorite dish: ${favDish}`);
      if (favCuisine) lines.push(`Favorite cuisine: ${favCuisine}`);
      if (mealType) lines.push(`Preferred meal: ${mealType}`);

      const content = lines.length ? lines.join('\n') : 'No preferences saved yet.';
      const speech = lines.length
        ? `Here are your saved preferences. ${lines.join('. ')}.`
        : 'You do not have any saved preferences yet.';

      return handlerInput.responseBuilder
        .speak(speech)
        .withSimpleCard('Your Preferences', content)
        .withShouldEndSession(false)
        .getResponse();
    } catch (err) {
      // Log using both logger and console for consistency
      this.logError(err as Error, handlerInput);
      console.error('Error in GetPreferencesIntent', err);
      return handlerInput.responseBuilder
        .speak('I had trouble retrieving your preferences. Please try again later.')
        .getResponse();
    }
  }
}
