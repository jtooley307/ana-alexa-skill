import { HandlerInput } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
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
      
      // Extract slots and build query
      const req = handlerInput.requestEnvelope.request as IntentRequest;
      const slots = req.intent.slots || {} as any;
      const mealTime = (slots.mealTime?.value as string | undefined)?.toLowerCase() || preferences.preferredMealType || 'dinner';
      const cuisine = (slots.cuisine?.value as string | undefined)?.toLowerCase();
      
      // Build query for the Meals API: e.g., "italian dinner" or "dinner"
      const query = [cuisine, mealTime].filter(Boolean).join(' ').trim() || `${mealTime} meal`;
      
      // Get meal recommendation from Meals API
      const meal = await recommendMeal(preferences, {
        query,
        cuisine,
        meal_type: mealTime,
        limit: 3,
      });
      
      // Format the response
      // Include the names of the top 3 dishes, prioritizing entree, side, appetizer/dessert
      const priority: Record<string, number> = {
        entree: 1,
        main: 1,
        side: 2,
        sides: 2,
        appetizer: 3,
        salad: 3,
        dessert: 4,
        drink: 5,
      };
      const topThreeNames = Array.from(
        new Map(
          meal.courses
            .slice()
            .sort((a, b) => (priority[a.type] || 99) - (priority[b.type] || 99))
            .map((c) => [c.name, c]) // de-duplicate by name
        ).values()
      )
        .slice(0, 3)
        .map((c) => c.name);

      const featuring = topThreeNames.length
        ? ` Featuring: ${topThreeNames.join(', ')}.`
        : '';

      const speechText = `I recommend ${meal.name}. ${meal.description}.${featuring}`;
      
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
