import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockService } from '../../../src/services/BedrockService';
import { createLogger } from '../../../src/utils/logger';

// Mock the logger to avoid actual logging during tests
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

// Mock the AWS Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  const mockSend = jest.fn();
  return {
    BedrockRuntimeClient: jest.fn(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: jest.fn(),
    mockSend,
  };
});

describe('BedrockService', () => {
  let mockSend: jest.Mock;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = (BedrockRuntimeClient as jest.Mock)().send;
    mockLogger = createLogger('test');
  });

  describe('extractEntities', () => {
    it('should extract entities from a restaurant query', async () => {
      // Mock Bedrock response
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              intent: 'RecommendRestaurant',
              cuisine: 'Italian',
              location: 'downtown',
              budget: true
            })
          }
        ]
      };
      
      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(JSON.stringify(mockResponse))
      });

      const result = await bedrockService.extractEntities('Find me a cheap Italian restaurant near downtown');
      
      expect(result).toEqual({
        intent: 'RecommendRestaurant',
        cuisine: 'italian',
        location: 'downtown',
        budget: true
      });
      
      // Verify Bedrock was called with the correct parameters
      expect(InvokeModelCommand).toHaveBeenCalledWith(expect.objectContaining({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
      }));
    });

    it('should extract entities from a dish query', async () => {
      // Mock Bedrock response
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              intent: 'RecommendDish',
              dishName: 'pasta carbonara',
              cuisine: 'Italian'
            })
          }
        ]
      };
      
      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(JSON.stringify(mockResponse))
      });

      const result = await bedrockService.extractEntities('Tell me about pasta carbonara');
      
      expect(result).toEqual({
        intent: 'RecommendDish',
        dishName: 'pasta carbonara',
        cuisine: 'italian'
      });
    });

    it('should handle invalid JSON response', async () => {
      // Mock invalid JSON response
      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode('not a valid json')
      });

      const result = await bedrockService.extractEntities('Find me a restaurant');
      
      expect(result).toEqual({ intent: 'Unknown' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error parsing Bedrock response', 
        expect.objectContaining({
          error: expect.any(String),
          response: 'not a valid json'
        })
      );
    });

    it('should handle Bedrock API errors', async () => {
      const error = new Error('API Error');
      mockSend.mockRejectedValueOnce(error);

      const result = await bedrockService.extractEntities('Find me a restaurant');
      
      expect(result).toEqual({ intent: 'Unknown' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error extracting entities with Bedrock', 
        expect.objectContaining({
          error: 'API Error',
          query: 'Find me a restaurant'
        })
      );
    });
  });

  describe('parseResponse', () => {
    it('should parse a valid response', () => {
      const response = JSON.stringify({
        intent: 'RecommendMeal',
        mealType: 'dinner',
        cuisine: 'Mexican',
        quick: true
      });

      // @ts-ignore - Accessing private method for testing
      const result = bedrockService.parseResponse(`Some text before ${response} and after`);
      
      expect(result).toEqual({
        intent: 'RecommendMeal',
        mealType: 'dinner',
        cuisine: 'mexican',
        quick: true
      });
    });

    it('should handle invalid JSON in response', () => {
      // @ts-ignore - Accessing private method for testing
      const result = bedrockService.parseResponse('not a json');
      expect(result).toEqual({ intent: 'Unknown' });
    });
  });
});
