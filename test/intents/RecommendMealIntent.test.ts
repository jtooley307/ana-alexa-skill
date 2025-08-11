import { RecommendMealIntentHandler } from '../../src/intents/RecommendMealIntent';
import { mockHandlerInput } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';

// Mock the external services
jest.mock('../../src/services/PreferencesService');

// Mock the meal recommendation service
jest.mock('../../src/services/MealService', () => ({
  recommendMeal: jest.fn().mockResolvedValue({
    name: 'Italian Feast',
    description: 'A complete Italian meal with appetizer, main course, and dessert',
    courses: [
      {
        name: 'Bruschetta',
        type: 'appetizer',
        description: 'Toasted bread topped with tomatoes, garlic, and basil'
      },
      {
        name: 'Spaghetti Carbonara',
        type: 'main',
        description: 'Pasta with eggs, cheese, pancetta, and black pepper'
      },
      {
        name: 'Tiramisu',
        type: 'dessert',
        description: 'Coffee-flavored Italian dessert'
      }
    ],
    totalPrepTime: 60,
    cuisine: 'italian',
    dietaryInfo: {
      vegetarian: false,
      vegan: false,
      glutenFree: false
    }
  })
}));

describe('RecommendMealIntent', () => {
  let handler: RecommendMealIntentHandler;
  const mockGetPreferences = preferencesService.getPreferences as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new RecommendMealIntentHandler();
    
    // Default mock implementation
    mockGetPreferences.mockResolvedValue({
      preferredCuisine: 'italian',
      preferredMealType: 'dinner',
      dietaryRestrictions: []
    });
  });

  it('should be able to handle RecommendMealIntent', () => {
    const handlerInput = mockHandlerInput('RecommendMealIntent', {
      cuisine: 'italian',
      mealType: 'dinner'
    });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should recommend a meal based on provided parameters', async () => {
    const handlerInput = mockHandlerInput('RecommendMealIntent', {
      cuisine: 'italian',
      mealType: 'dinner'
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I recommend an Italian Feast')
    );
    expect(handlerInput.responseBuilder.withSimpleCard).toHaveBeenCalledWith(
      'Meal Recommendation',
      expect.stringContaining('Italian Feast')
    );
  });

  it('should use user preferences when no slots are provided', async () => {
    const handlerInput = mockHandlerInput('RecommendMealIntent', {});
    
    await handler.handle(handlerInput);
    
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Italian Feast')
    );
  });

  it('should handle dietary restrictions', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      preferredCuisine: 'italian',
      preferredMealType: 'dinner',
      dietaryRestrictions: ['vegetarian']
    });
    
    const handlerInput = mockHandlerInput('RecommendMealIntent', {
      cuisine: 'italian',
      mealType: 'dinner'
    });
    
    await handler.handle(handlerInput);
    
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Italian Feast')
    );
  });

  it('should handle errors when getting preferences', async () => {
    const handlerInput = mockHandlerInput('RecommendMealIntent', {
      cuisine: 'italian',
      mealType: 'dinner'
    });
    
    const testError = new Error('Database error');
    mockGetPreferences.mockRejectedValueOnce(testError);
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in RecommendMealIntent',
      testError
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I had trouble getting your preferences')
    );
    
    consoleErrorSpy.mockRestore();
  });

  it('should handle no recommendations found', async () => {
    // Mock MealService to return null (no recommendations)
    jest.resetModules();
    jest.doMock('../../src/services/MealService', () => ({
      recommendMeal: jest.fn().mockResolvedValue(null)
    }));
    
    // Re-import the handler to use the new mock
    const { RecommendMealIntentHandler } = require('../../src/intents/RecommendMealIntent');
    const handler = new RecommendMealIntentHandler();
    
    const handlerInput = mockHandlerInput('RecommendMealIntent', {
      cuisine: 'italian',
      mealType: 'dinner'
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I couldn\'t find any meals matching your criteria')
    );
  });
});
