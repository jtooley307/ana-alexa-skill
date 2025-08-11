import { SaveFavoriteRestaurantIntentHandler } from '../../src/intents/SaveFavoriteRestaurantIntent';
import { mockHandlerInput, TEST_USER_ID } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';

// Mock the PreferencesService
jest.mock('../../src/services/PreferencesService');

// Store original console methods
const originalConsole = { ...console };

// Mock console methods before all tests
beforeAll(() => {
  // Mock console methods we want to test
  console.info = jest.fn();
  console.error = jest.fn();
});

// Reset mocks and restore console methods after all tests
afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('SaveFavoriteRestaurantIntent', () => {
  let handler: SaveFavoriteRestaurantIntentHandler;
  const mockUpdatePreferences = preferencesService.updatePreferences as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SaveFavoriteRestaurantIntentHandler();
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  it('should be able to handle SaveFavoriteRestaurantIntent', () => {
    const handlerInput = mockHandlerInput('SaveFavoriteRestaurantIntent', { 
      restaurantName: { value: 'Olive Garden' } 
    });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should save favorite restaurant and respond appropriately', async () => {
    const handlerInput = mockHandlerInput('SaveFavoriteRestaurantIntent', { 
      restaurantName: { value: 'Olive Garden' } 
    });
    
    const response = await handler.handle(handlerInput);
    const responseOutput = handlerInput.responseBuilder.getResponse();
    
    expect(response).toBeDefined();
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      TEST_USER_ID,
      { favoriteRestaurant: 'Olive Garden' }
    );
    
    // Check the response using the actual response object
    expect(responseOutput.response.outputSpeech.ssml).toContain(
      "I've saved Olive Garden as your favorite restaurant"
    );
    expect(responseOutput.response.card.title).toBe('Favorite Restaurant Saved');
    expect(responseOutput.response.card.content).toContain('Olive Garden');
    
    // Verify logging
    expect(console.info).toHaveBeenCalled();
    
    // Get all info log calls and find the one we're interested in
    const infoCalls = (console.info as jest.Mock).mock.calls;
    const saveCall = infoCalls.find(call => 
      call[0].includes('Saving favorite restaurant')
    );
    
    expect(saveCall).toBeDefined();
    expect(saveCall[0]).toContain('[INFO] [app] Saving favorite restaurant');
    expect(saveCall[0]).toContain(`"userId":"${TEST_USER_ID}"`);
    expect(saveCall[0]).toContain('"restaurantName":"Olive Garden"');
    expect(saveCall[0]).toContain('"intent":"SaveFavoriteRestaurantIntent"');
  });

  it('should handle missing restaurant name', async () => {
    const handlerInput = mockHandlerInput('SaveFavoriteRestaurantIntent', {});
    
    const response = await handler.handle(handlerInput);
    const responseOutput = handlerInput.responseBuilder.getResponse();
    
    expect(response).toBeDefined();
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    expect(responseOutput.response.outputSpeech.ssml).toContain(
      "I'm sorry, I didn't catch the name of the restaurant"
    );
    expect(responseOutput.response.reprompt).toBeDefined();
  });

  it('should handle errors when saving preferences', async () => {
    const testError = new Error('Database error');
    const handlerInput = mockHandlerInput('SaveFavoriteRestaurantIntent', { 
      restaurantName: { value: 'Olive Garden' } 
    });
    
    mockUpdatePreferences.mockRejectedValueOnce(testError);
    
    const response = await handler.handle(handlerInput);
    const responseOutput = handlerInput.responseBuilder.getResponse();
    
    expect(response).toBeDefined();
    
    // Verify that the error was logged
    expect(console.error).toHaveBeenCalled();
    
    // Get all error log calls and find the one we're interested in
    const errorCalls = (console.error as jest.Mock).mock.calls;
    const errorCall = errorCalls.find(call => 
      call[0].includes('Error in SaveFavoriteRestaurantIntent')
    );
    
    expect(errorCall).toBeDefined();
    
    // The error message should be in the format: [timestamp] [ERROR] [app] Error in SaveFavoriteRestaurantIntent {json}
    expect(errorCall[0]).toContain('[ERROR] [app] Error in SaveFavoriteRestaurantIntent');
    
    // Extract the JSON part of the error message
    const jsonStart = errorCall[0].indexOf('{');
    expect(jsonStart).toBeGreaterThan(-1);
    
    const jsonStr = errorCall[0].slice(jsonStart);
    const logContent = JSON.parse(jsonStr);
    
    // Verify the log content structure
    // The error object is logged directly with stack trace
    // We'll just verify the stack trace contains the error message
    expect(logContent.error.stack).toContain('Error: Database error');
    
    // For now, we'll just verify that the error object exists and has a stack trace
    expect(logContent.error).toBeDefined();
    expect(typeof logContent.error.stack).toBe('string');
    
    // Verify response
    expect(responseOutput.response.outputSpeech.ssml).toContain(
      'I had trouble saving your favorite restaurant'
    );
    expect(responseOutput.response.card).toBeDefined();
    expect(responseOutput.response.card.title).toBe('Error');
    expect(responseOutput.response.card.content).toContain('I had trouble saving your favorite restaurant');
  });
});
