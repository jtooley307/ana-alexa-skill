// Mock the logger module first, before any imports
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock the logger module with our mock implementation
jest.mock('../../src/utils/logger', () => ({
  createLogger: jest.fn().mockImplementation(() => mockLogger),
  logger: mockLogger
}));

// Now import the modules that depend on the logger
import { HandlerInput } from 'ask-sdk-core';
import { RecommendDishIntentHandler } from '../../src/intents/RecommendDishIntent';
import { mockHandlerInput } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';
import { apiClient } from '../../src/services/ApiClient';

// Mock the external services
jest.mock('../../src/services/PreferencesService');
jest.mock('../../src/services/ApiClient');

describe('RecommendDishIntent', () => {
  let handler: RecommendDishIntentHandler;
  const mockGetPreferences = preferencesService.getPreferences as jest.Mock;
  const mockGetHistoricalDishes = apiClient.getHistoricalDishes as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mock functions
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
    
    // Create a new handler instance
    handler = new RecommendDishIntentHandler();
    
    // Default mock implementations
    mockGetPreferences.mockResolvedValue({
      preferredCuisine: 'italian',
      preferredMealType: 'dinner',
      dietaryRestrictions: []
    });

    mockGetHistoricalDishes.mockResolvedValue({
      data: [{
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, mozzarella, and basil',
        cuisine: 'Italian',
        mealType: 'dinner',
        cookingTime: 30,
        ingredients: ['pizza dough', 'tomato sauce', 'mozzarella', 'basil', 'olive oil']
      }]
    });
  });

  it('should be able to handle RecommendDishIntent', () => {
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'italian' },
      mealType: { value: 'dinner' }
    });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should recommend a dish based on provided parameters', async () => {
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'italian' },
      mealType: { value: 'dinner' }
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1,
      cuisine: 'italian'
    });
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('For dinner, I recommend Margherita Pizza')
    );
    expect(handlerInput.responseBuilder.withSimpleCard).toHaveBeenCalledWith(
      'Dish Recommendation',
      expect.stringContaining('Margherita Pizza')
    );
  });

  it('should use user preferences when no slots are provided', async () => {
    const handlerInput = mockHandlerInput('RecommendDishIntent', {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1
    });
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('For dinner, I recommend Margherita Pizza')
    );
  });

  it('should handle errors when getting preferences', async () => {
    const testError = new Error('Preferences error');
    mockGetPreferences.mockRejectedValueOnce(testError);
    
    // Mock the historical dishes response since the handler will still try to fetch recommendations
    mockGetHistoricalDishes.mockResolvedValueOnce({
      data: [{
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, mozzarella, and basil',
        cuisine: 'Italian',
        mealType: 'dinner',
        cookingTime: 30,
        ingredients: ['pizza dough', 'tomato sauce', 'mozzarella', 'basil', 'olive oil']
      }]
    });
    
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'italian' },
      mealType: { value: 'dinner' }
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error getting user preferences',
      testError,
      { userId: 'test-user-id' }
    );
    // The handler should still return a successful response with a recommendation
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('For dinner, I recommend Margherita Pizza')
    );
  });

  it('should handle no recommendations found', async () => {
    // Mock no dishes found
    mockGetHistoricalDishes.mockResolvedValueOnce({ data: [] });
    
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'italian' },
      mealType: { value: 'dinner' }
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I'm sorry, I couldn't find any italian dishes for dinner.")
    );
  });

  it('should handle API errors when fetching dishes', async () => {
    const testError = new Error('API error');
    mockGetHistoricalDishes.mockRejectedValueOnce(testError);
    
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'italian' },
      mealType: { value: 'dinner' }
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error in RecommendDishIntent',
      testError
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I had trouble finding a dish recommendation')
    );
  });

  it('should handle different meal types and cuisines', async () => {
    // Test breakfast with no cuisine
    mockGetHistoricalDishes.mockResolvedValueOnce({
      data: [{
        name: 'Avocado Toast',
        description: 'Toasted bread with avocado and seasonings',
        cuisine: 'American',
        mealType: 'breakfast',
        ingredients: ['bread', 'avocado', 'salt', 'pepper', 'olive oil']
      }]
    });
    
    const breakfastHandlerInput = mockHandlerInput('RecommendDishIntent', {
      mealType: { value: 'breakfast' }
    });
    
    await handler.handle(breakfastHandlerInput);
    
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1
      // No cuisine specified
    });
    
    // Test lunch with a specific cuisine
    mockGetHistoricalDishes.mockResolvedValueOnce({
      data: [{
        name: 'Pad Thai',
        description: 'Stir-fried rice noodle dish',
        cuisine: 'Thai',
        mealType: 'lunch',
        ingredients: ['rice noodles', 'tofu', 'peanuts', 'bean sprouts', 'eggs']
      }]
    });
    
    const lunchHandlerInput = mockHandlerInput('RecommendDishIntent', {
      cuisine: { value: 'thai' },
      mealType: { value: 'lunch' }
    });
    
    await handler.handle(lunchHandlerInput);
    
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1,
      cuisine: 'thai'
    });
  });

  it('should build correct response and card text', () => {
    const dish = {
      name: 'Test Dish',
      description: 'A delicious test dish',
      ingredients: ['ing1', 'ing2']
    };
    
    // Test response building
    const response = (handler as any).buildResponse(dish, 'dinner', 'TestCuisine');
    expect(response).toContain('For dinner, I recommend Test Dish');
    expect(response).toContain('TestCuisine');
    expect(response).toContain('Would you like to know more');
    
    // Test card text building
    const cardText = (handler as any).buildCardText(dish, 'dinner', 'TestCuisine');
    expect(cardText).toContain('Recommended dinner dish');
    expect(cardText).toContain('Name: Test Dish');
    expect(cardText).toContain('Description: A delicious test dish');
    expect(cardText).toContain('Cuisine: TestCuisine');
    expect(cardText).toContain('ing1, ing2');
    
    // Test with minimal dish data
    const minimalDish = { name: 'Minimal Dish' };
    const minimalResponse = (handler as any).buildResponse(minimalDish, 'lunch');
    expect(minimalResponse).toContain('For lunch, I recommend Minimal Dish');
    
    const minimalCardText = (handler as any).buildCardText(minimalDish, 'lunch');
    expect(minimalCardText).toContain('Name: Minimal Dish');
  });

  it('should handle missing dish name in response', async () => {
    mockGetHistoricalDishes.mockResolvedValueOnce({
      data: [{
        // No name provided
        description: 'A mysterious dish',
        cuisine: 'Mystery',
        mealType: 'dinner'
      }]
    });
    
    const handlerInput = mockHandlerInput('RecommendDishIntent', {
      mealType: { value: 'dinner' }
    });
    
    const response = await handler.handle(handlerInput);
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('For dinner, I recommend a delicious dish')
    );
  });

  it('should handle empty slots object', async () => {
    const handlerInput = mockHandlerInput('RecommendDishIntent', {});
    
    await handler.handle(handlerInput);
    
    // Should use default values from preferences
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1
      // cuisine is optional in the actual implementation
    });
  });

  it('should handle null or undefined slots', async () => {
    const handlerInput = {
      ...mockHandlerInput('RecommendDishIntent', {
        cuisine: { value: null },
        mealType: { value: undefined }
      })
    } as unknown as HandlerInput;
    
    await handler.handle(handlerInput);
    
    // Should use default values from preferences
    expect(mockGetHistoricalDishes).toHaveBeenCalledWith({
      era: 'modern',
      limit: 1
      // cuisine is optional in the actual implementation
    });
  });
});
