import { NaturalLanguageQueryIntentHandler } from '../../src/intents/NaturalLanguageQueryIntent';
import { mockHandlerInput } from '../test-utils';
import { nlqRouter } from '../../src/services/NLQRouter';
import { RecommendDishIntentHandler } from '../../src/intents/RecommendDishIntent';
import { RecommendMealIntentHandler } from '../../src/intents/RecommendMealIntent';
import { RecommendRestaurantIntentHandler } from '../../src/intents/RecommendRestaurantIntent';
import { logger } from '../../src/utils/logger';

// Mock the NLQRouter and intent handlers
jest.mock('../../src/services/NLQRouter');

// Define mock handler types
interface MockIntentHandler {
  handle: jest.Mock<Promise<any>, [any]>;
}

// Create mock handler instances with proper typing
const createMockHandler = (): MockIntentHandler => ({
  handle: jest.fn().mockResolvedValue({})
});

// Create typed mock constructors
const MockRecommendDishIntentHandler = jest.fn().mockImplementation(createMockHandler);
const MockRecommendMealIntentHandler = jest.fn().mockImplementation(createMockHandler);
const MockRecommendRestaurantIntentHandler = jest.fn().mockImplementation(createMockHandler);

// Mock the intent handler modules
jest.mock('../../src/intents/RecommendDishIntent', () => ({
  RecommendDishIntentHandler: MockRecommendDishIntentHandler
}));

jest.mock('../../src/intents/RecommendMealIntent', () => ({
  RecommendMealIntentHandler: MockRecommendMealIntentHandler
}));

jest.mock('../../src/intents/RecommendRestaurantIntent', () => ({
  RecommendRestaurantIntentHandler: MockRecommendRestaurantIntentHandler
}));

// Import the centralized logger mock
import { mockLogger, resetLoggerMocks } from '../__mocks__/logger';

// Mock the logger module
jest.mock('../../src/utils/logger');

describe('NaturalLanguageQueryIntent', () => {
  let handler: NaturalLanguageQueryIntentHandler;
  let mockProcessQuery: jest.Mock;
  let mockDishHandler: { handle: jest.Mock };
  let mockMealHandler: { handle: jest.Mock };
  let mockRestaurantHandler: { handle: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    resetLoggerMocks();
    
    // Reset mock handlers
    mockDishHandler = new MockRecommendDishIntentHandler();
    mockMealHandler = new MockRecommendMealIntentHandler();
    mockRestaurantHandler = new MockRecommendRestaurantIntentHandler();
    
    // Clear mock instances and implementations
    MockRecommendDishIntentHandler.mockClear();
    MockRecommendMealIntentHandler.mockClear();
    MockRecommendRestaurantIntentHandler.mockClear();
    
    // Setup mock implementations
    MockRecommendDishIntentHandler.mockImplementation(() => mockDishHandler);
    MockRecommendMealIntentHandler.mockImplementation(() => mockMealHandler);
    MockRecommendRestaurantIntentHandler.mockImplementation(() => mockRestaurantHandler);
    
    // Get the mock processQuery function
    mockProcessQuery = nlqRouter.processQuery as jest.Mock;
    
    // Create a fresh handler instance for each test
    handler = new NaturalLanguageQueryIntentHandler();
  });

  it('should be able to handle NaturalLanguageQueryIntent', () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'recommend a dish' } 
    });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should handle dish recommendation queries', async () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'recommend a pasta dish' } 
    });
    
    // Mock the NLQ router to return a dish recommendation
    mockProcessQuery.mockResolvedValueOnce({
      action: 'RecommendDish',
      entities: { mealType: 'dinner', cuisine: 'italian' }
    });

    await handler.handle(handlerInput);

    expect(mockProcessQuery).toHaveBeenCalledWith('recommend a pasta dish', handlerInput);
    expect(mockDishHandler.handle).toHaveBeenCalled();
  });

  it('should handle meal recommendation queries', async () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'what should I eat for lunch' } 
    });
    
    mockProcessQuery.mockResolvedValueOnce({
      action: 'RecommendMeal',
      entities: { mealTime: 'lunch', cuisine: 'mexican' }
    });

    await handler.handle(handlerInput);

    expect(mockProcessQuery).toHaveBeenCalledWith('what should I eat for lunch', handlerInput);
    expect(mockMealHandler.handle).toHaveBeenCalled();
  });

  it('should handle restaurant recommendation queries', async () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'find me an Italian restaurant' } 
    });
    
    mockProcessQuery.mockResolvedValueOnce({
      action: 'RecommendRestaurant',
      entities: { location: 'Seattle', cuisine: 'italian' }
    });

    await handler.handle(handlerInput);

    expect(mockProcessQuery).toHaveBeenCalledWith('find me an Italian restaurant', handlerInput);
    expect(mockRestaurantHandler.handle).toHaveBeenCalled();
  });

  it('should handle unknown queries', async () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'random query' } 
    });
    
    mockProcessQuery.mockResolvedValueOnce({
      action: 'Unknown',
      entities: {}
    });

    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I\'m not sure how to help with')
    );
  });

  it('should handle missing query', async () => {
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I'm sorry, I didn't catch that")
    );
  });

  it('should handle errors gracefully', async () => {
    const testError = new Error('Test error');
    const handlerInput = mockHandlerInput('NaturalLanguageQueryIntent', { 
      query: { value: 'recommend something' } 
    });
    
    mockProcessQuery.mockRejectedValueOnce(testError);

    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error in NaturalLanguageQueryIntent',
      testError,
      expect.any(Object)
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I had trouble understanding your request')
    );
  });
});
