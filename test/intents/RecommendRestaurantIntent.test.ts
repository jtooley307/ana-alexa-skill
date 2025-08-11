import { RecommendRestaurantIntentHandler } from '../../src/intents/RecommendRestaurantIntent';
import { mockHandlerInput } from '../test-utils';
import { preferencesService } from '../../src/services/PreferencesService';

// Mock the external services
jest.mock('../../src/services/PreferencesService');

// Mock the restaurant recommendation service
jest.mock('../../src/services/RestaurantService', () => ({
  recommendRestaurant: jest.fn().mockResolvedValue({
    name: 'La Trattoria',
    cuisine: 'Italian',
    address: '123 Pasta St, Foodie City',
    rating: 4.5,
    priceRange: '$$',
    distance: '0.5 miles',
    openingHours: {
      monday: '11:00 AM - 10:00 PM',
      tuesday: '11:00 AM - 10:00 PM',
      wednesday: '11:00 AM - 10:00 PM',
      thursday: '11:00 AM - 11:00 PM',
      friday: '11:00 AM - 11:00 PM',
      saturday: '12:00 PM - 11:00 PM',
      sunday: '12:00 PM - 9:00 PM'
    },
    contact: {
      phone: '(555) 123-4567',
      website: 'https://latrattoria.example.com'
    },
    dietaryOptions: {
      vegetarian: true,
      vegan: true,
      glutenFree: true
    }
  })
}));

describe('RecommendRestaurantIntent', () => {
  let handler: RecommendRestaurantIntentHandler;
  const mockGetPreferences = preferencesService.getPreferences as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new RecommendRestaurantIntentHandler();
    
    // Default mock implementation
    mockGetPreferences.mockResolvedValue({
      favoriteCuisine: 'italian',
      preferredPriceRange: '$$',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: 'San Francisco'
      },
      dietaryRestrictions: []
    });
  });

  it('should be able to handle RecommendRestaurantIntent', () => {
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian',
      location: 'San Francisco'
    });
    expect(handler.canHandle(handlerInput)).toBe(true);
  });

  it('should not handle other intents', () => {
    const handlerInput = mockHandlerInput('OtherIntent');
    expect(handler.canHandle(handlerInput)).toBe(false);
  });

  it('should recommend a restaurant based on provided parameters', async () => {
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian',
      location: 'San Francisco'
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I recommend La Trattoria')
    );
    expect(handlerInput.responseBuilder.withSimpleCard).toHaveBeenCalledWith(
      'Restaurant Recommendation',
      expect.stringContaining('La Trattoria')
    );
  });

  it('should use user preferences when no slots are provided', async () => {
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {});
    
    await handler.handle(handlerInput);
    
    expect(mockGetPreferences).toHaveBeenCalledWith('test-user-id');
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('La Trattoria')
    );
  });

  it('should handle dietary restrictions', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      favoriteCuisine: 'italian',
      preferredPriceRange: '$$',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: 'San Francisco'
      },
      dietaryRestrictions: ['vegetarian', 'vegan']
    });
    
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian',
      location: 'San Francisco'
    });
    
    await handler.handle(handlerInput);
    
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('La Trattoria')
    );
  });

  it('should handle location from device address', async () => {
    // Mock the device address service
    const mockDeviceAddressService = {
      getCountryAndPostalCode: jest.fn().mockResolvedValue({
        postalCode: '94103',
        countryCode: 'US'
      })
    };
    
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian'
    });
    
    // Add device address service to the context
    handlerInput.serviceClientFactory = {
      getDeviceAddressServiceClient: jest.fn().mockReturnValue(mockDeviceAddressService)
    };
    
    await handler.handle(handlerInput);
    
    expect(mockDeviceAddressService.getCountryAndPostalCode).toHaveBeenCalled();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('La Trattoria')
    );
  });

  it('should handle errors when getting preferences', async () => {
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian',
      location: 'San Francisco'
    });
    
    const testError = new Error('Database error');
    mockGetPreferences.mockRejectedValueOnce(testError);
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in RecommendRestaurantIntent',
      testError
    );
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I had trouble getting your preferences')
    );
    
    consoleErrorSpy.mockRestore();
  });

  it('should handle no recommendations found', async () => {
    // Mock RestaurantService to return null (no recommendations)
    jest.resetModules();
    jest.doMock('../../src/services/RestaurantService', () => ({
      recommendRestaurant: jest.fn().mockResolvedValue(null)
    }));
    
    // Re-import the handler to use the new mock
    const { RecommendRestaurantIntentHandler } = require('../../src/intents/RecommendRestaurantIntent');
    const handler = new RecommendRestaurantIntentHandler();
    
    const handlerInput = mockHandlerInput('RecommendRestaurantIntent', {
      cuisine: 'italian',
      location: 'San Francisco'
    });
    
    const response = await handler.handle(handlerInput);
    
    expect(response).toBeDefined();
    expect(handlerInput.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('I couldn\'t find any restaurants matching your criteria')
    );
  });
});
