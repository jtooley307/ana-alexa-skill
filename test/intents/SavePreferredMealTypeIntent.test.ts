import { SavePreferredMealTypeIntentHandler } from '../../src/intents/SavePreferredMealTypeIntent';
import { mockHandlerInput } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';

// Mock the PreferencesService
jest.mock('../../src/services/PreferencesService');

describe('SavePreferredMealTypeIntent', () => {
  let handler: SavePreferredMealTypeIntentHandler;
  const mockUpdatePreferences = preferencesService.updatePreferences as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SavePreferredMealTypeIntentHandler();
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  it('should be able to handle SavePreferredMealTypeIntent', () => {
    const handlerInput = mockHandlerInput('SavePreferredMealTypeIntent', { mealType: 'dinner' });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should save valid meal type and respond appropriately', async () => {
    const handlerInput = mockHandlerInput('SavePreferredMealTypeIntent', { mealType: 'dinner' });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      'test-user-id',
      { preferredMealType: 'dinner' }
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I've saved your preference for a dinner meal")
    );
  });

  it('should handle invalid meal type', async () => {
    const handlerInput = mockHandlerInput('SavePreferredMealTypeIntent', { mealType: 'invalid' });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I'm sorry, \"invalid\" doesn't seem to be a valid meal type")
    );
    expect(handlerInput.responseBuilder.reprompt).toHaveBeenCalled();
  });

  it('should handle missing meal type', async () => {
    const handlerInput = mockHandlerInput('SavePreferredMealTypeIntent', {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I'm sorry, \"that\" doesn't seem to be a valid meal type")
    );
  });

  it('should handle errors when saving preferences', async () => {
    const handlerInput = mockHandlerInput('SavePreferredMealTypeIntent', { mealType: 'dinner' });
    const testError = new Error('Database error');
    mockUpdatePreferences.mockRejectedValueOnce(testError);
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in SavePreferredMealTypeIntent',
      testError
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I had trouble saving your meal preference')
    );
    
    consoleErrorSpy.mockRestore();
  });
});
