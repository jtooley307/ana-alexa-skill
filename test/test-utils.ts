import { 
  HandlerInput, 
  getIntentRequest, 
  getLaunchRequest, 
  getSessionEndedRequest,
  ResponseBuilder
} from './__mocks__/ask-sdk-core';

// Default test user ID to use across all tests
export const TEST_USER_ID = 'test-user-id';

// Create a fresh ResponseBuilder instance for each test
export const createResponseBuilder = () => {
  const builder = new ResponseBuilder();
  // Reset all mocks on the instance
  Object.values(builder).forEach((prop) => {
    if (typeof prop === 'function' && 'mockClear' in prop) {
      prop.mockClear();
    }
  });
  return builder;
};

export const createTestHandlerInput = (request: any, userId: string = TEST_USER_ID) => {
  const handlerInput = HandlerInput.from(request, {
    System: {
      device: {
        deviceId: 'test-device-id',
        supportedInterfaces: {}
      },
      apiEndpoint: 'https://api.amazonalexa.com',
      application: {
        applicationId: 'test-application-id'
      },
      user: {
        userId: userId,
        accessToken: 'test-access-token',
        permissions: {}
      }
    }
  });

  // Create a fresh response builder for each handler input
  handlerInput.responseBuilder = createResponseBuilder();
  
  return handlerInput;
};

export const mockHandlerInput = (intentName: string, slots: Record<string, any> = {}, userId: string = TEST_USER_ID) => {
  const request = getIntentRequest(intentName, slots);
  return createTestHandlerInput(request, userId);
};

export const mockLaunchRequest = (userId: string = TEST_USER_ID) => {
  const request = getLaunchRequest();
  return createTestHandlerInput(request, userId);
};

export const mockSessionEndedRequest = (userId: string = TEST_USER_ID) => {
  const request = getSessionEndedRequest();
  return createTestHandlerInput(request, userId);
};

export const mockServiceClientFactory = {
  getUpsServiceClient: jest.fn(),
  getDeviceAddressServiceClient: jest.fn(),
  getDirectiveServiceClient: jest.fn(),
  getApiClient: jest.fn()
};

export const mockServiceClient = {
  getProfileName: jest.fn(),
  getProfileEmail: jest.fn(),
  getProfileMobileNumber: jest.fn(),
  getDeviceAddress: jest.fn()
};

// Reset all mocks between tests
export const resetAllMocks = () => {
  mockServiceClientFactory.getUpsServiceClient.mockClear();
  mockServiceClient.getProfileName.mockClear();
  mockServiceClient.getProfileEmail.mockClear();
  mockServiceClient.getProfileMobileNumber.mockClear();
  mockServiceClient.getDeviceAddress.mockClear();
};
