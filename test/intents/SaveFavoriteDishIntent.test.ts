import { SaveFavoriteDishIntentHandler } from '../../src/intents/SaveFavoriteDishIntent';
import { mockHandlerInput, TEST_USER_ID } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';

// Mock the PreferencesService
jest.mock('../../src/services/PreferencesService');

describe('SaveFavoriteDishIntent', () => {
  let handler: SaveFavoriteDishIntentHandler;
  const mockUpdatePreferences = preferencesService.updatePreferences as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SaveFavoriteDishIntentHandler();
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  it('should be able to handle SaveFavoriteDishIntent', () => {
    const handlerInput = mockHandlerInput('SaveFavoriteDishIntent', { dishName: { value: 'pizza' } });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should save favorite dish and respond appropriately', async () => {
    // Mock the handler input with a dish name
    const handlerInput = mockHandlerInput('SaveFavoriteDishIntent', { 
      dishName: { value: 'pizza' } 
    });
    
    // Mock the response builder
    const mockResponseBuilder = {
      speak: jest.fn().mockReturnThis(),
      withSimpleCard: jest.fn().mockReturnThis(),
      withShouldEndSession: jest.fn().mockReturnThis(),
      getResponse: jest.fn().mockReturnValue({
        response: {
          outputSpeech: { ssml: '<speak>I\'ve saved pizza as your favorite dish. You can ask me to recommend similar dishes anytime.</speak>', type: 'SSML' },
          card: {
            type: 'Simple',
            title: 'Favorite Dish Saved',
            content: 'Favorite dish saved: pizza'
          },
          shouldEndSession: false
        },
        version: '1.0',
        sessionAttributes: {}
      })
    };
    
    // Mock the handler input's response builder
    handlerInput.responseBuilder = mockResponseBuilder;
    
    // Call the handler
    const response = await handler.handle(handlerInput);
    
    // Verify the response
    expect(response).toBeDefined();
    const responseBody = response as any; // Type assertion to bypass TypeScript checking
    expect(responseBody.response.outputSpeech.ssml).toContain("I've saved pizza as your favorite dish");
    expect(responseBody.response.card.title).toBe('Favorite Dish Saved');
    expect(responseBody.response.card.content).toContain('Favorite dish saved: pizza');
    expect(responseBody.response.shouldEndSession).toBe(false);
    
    // Verify the preferences service was called with the correct arguments
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      TEST_USER_ID,
      { favoriteDish: 'pizza' }
    );
  });

  it('should handle missing dish name', async () => {
    const handlerInput = mockHandlerInput('SaveFavoriteDishIntent', {});
    
    await handler.handle(handlerInput);
    const responseOutput = handlerInput.responseBuilder.getResponse();
    
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    expect(responseOutput.response.outputSpeech.ssml).toContain(
      "I'm sorry, I didn't catch the name of the dish"
    );
    expect(responseOutput.response.reprompt).toBeDefined();
  });

  it('should handle errors when saving preferences', async () => {
    const handlerInput = mockHandlerInput('SaveFavoriteDishIntent', { 
      dishName: { value: 'pizza' } 
    });
    
    const testError = new Error('Database error');
    mockUpdatePreferences.mockRejectedValueOnce(testError);
    
    // Create an array to capture error logs
    const errorLogs: any[] = [];
    
    // Mock the console.error method to capture the error logs
    const mockLoggerError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errorLogs.push(args);
    });
    
    await handler.handle(handlerInput);
    const responseOutput = handlerInput.responseBuilder.getResponse();
    
    // Verify that the error was logged
    expect(mockLoggerError).toHaveBeenCalled();
    
    // Check that we have at least one error log
    expect(errorLogs.length).toBeGreaterThan(0);
    
    // Get the formatted error message from the logger
    const errorMessage = errorLogs[0][0];
    
    // The error message should be in the format: [timestamp] [ERROR] [app] Error in intent handler {json}
    expect(errorMessage).toContain('[ERROR] [app] Error in intent handler');
    
    // Extract the JSON part of the error message
    const jsonStart = errorMessage.indexOf('{');
    expect(jsonStart).toBeGreaterThan(-1);
    
    const jsonStr = errorMessage.slice(jsonStart);
    const logContent = JSON.parse(jsonStr);
    
    // Verify the log content structure
    expect(logContent).toMatchObject({
      intent: 'SaveFavoriteDishIntent',
      requestId: expect.any(String),
      userId: 'test-user-id',
      error: {
        message: 'Database error',
        name: 'Error',
        stack: expect.any(String)
      }
    });
    
    // Verify the response
    expect(responseOutput.response.outputSpeech.ssml).toContain(
      'I had trouble saving your favorite dish'
    );
    expect(responseOutput.response.card).toBeDefined();
    expect(responseOutput.response.card.title).toBe('Error');
    expect(responseOutput.response.shouldEndSession).toBe(true);
    
    // Clean up
    mockLoggerError.mockRestore();
  });
});
