// Mock ResponseBuilder class
export class ResponseBuilder {
  private outputSpeech: any = null;
  private repromptOutput: any = null;
  private card: any = null;
  private shouldEndSession: boolean = true;

  speak = jest.fn().mockImplementation((speechOutput: string) => {
    this.outputSpeech = {
      type: 'SSML',
      ssml: `<speak>${speechOutput}</speak>`
    };
    return this;
  });

  reprompt = jest.fn().mockImplementation((repromptSpeechOutput: string) => {
    this.repromptOutput = {
      outputSpeech: {
        type: 'SSML',
        ssml: `<speak>${repromptSpeechOutput}</speak>`
      }
    };
    return this;
  });

  withSimpleCard = jest.fn().mockImplementation((title: string, content: string) => {
    this.card = {
      type: 'Simple',
      title,
      content
    };
    return this;
  });

  withShouldEndSession = jest.fn().mockImplementation((shouldEnd: boolean) => {
    this.shouldEndSession = shouldEnd;
    return this;
  });

  getResponse = jest.fn().mockImplementation(() => ({
    version: '1.0',
    response: {
      outputSpeech: this.outputSpeech,
      card: this.card,
      reprompt: this.repromptOutput,
      shouldEndSession: this.shouldEndSession
    },
    sessionAttributes: {}
  }));
}

export const HandlerInput = {
  from: jest.fn().mockImplementation((request, context) => {
    const handlerInput = {
      requestEnvelope: {
        request,
        context: context || {},
        session: {
          user: {
            userId: context?.System?.user?.userId || 'anonymous'
          }
        }
      },
      responseBuilder: new ResponseBuilder(),
      attributesManager: {
        getSessionAttributes: jest.fn().mockReturnValue({}),
        setSessionAttributes: jest.fn(),
        getPersistentAttributes: jest.fn().mockResolvedValue({}),
        setPersistentAttributes: jest.fn(),
        savePersistentAttributes: jest.fn().mockResolvedValue(undefined)
      },
      serviceClientFactory: {
        getUpsServiceClient: jest.fn()
      }
    };
    return handlerInput;
  })
};

export const getRequest = (type: string, intentName: string | null = null, slots: Record<string, any> = {}) => {
  // Process slots to extract values if they're objects with a 'value' property
  const processedSlots = Object.keys(slots).reduce<Record<string, any>>((acc, key) => {
    const slotValue = slots[key];
    // If the slot value is an object with a 'value' property, extract it
    const value = slotValue && typeof slotValue === 'object' && 'value' in slotValue 
      ? slotValue.value 
      : slotValue;
    
    const slotId = (typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '_') : '');
      
    acc[key] = {
      name: key,
      value: value,
      confirmationStatus: 'NONE',
      source: 'USER',
      resolutions: {
        resolutionsPerAuthority: [{
          status: { code: 'ER_SUCCESS_MATCH' },
          values: [{
            value: {
              name: value,
              id: slotId
            }
          }]
        }]
      }
    };
    
    return acc;
  }, {});
  
  const request: any = {
    type,
    requestId: `EdwRequestId.${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    locale: 'en-US'
  };
  
  if (intentName) {
    request.intent = {
      name: intentName,
      confirmationStatus: 'NONE',
      slots: processedSlots
    };
  }
  
  return request;
};

export const getIntentRequest = (intentName: string, slots: Record<string, any> = {}) => 
  getRequest('IntentRequest', intentName, slots);

export const getLaunchRequest = () => getRequest('LaunchRequest');

export const getSessionEndedRequest = () => getRequest('SessionEndedRequest');

export const mockPersistentAdapter = {
  getAttributes: jest.fn().mockResolvedValue({}),
  saveAttributes: jest.fn().mockResolvedValue(undefined),
  deleteAttributes: jest.fn().mockResolvedValue(undefined)
};

export const mockResponseBuilder = new ResponseBuilder();
