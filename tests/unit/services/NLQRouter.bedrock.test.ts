import { NLQRouter } from '../../../src/services/NLQRouter';
import { bedrockService } from '../../../src/services/BedrockService';
import { createLogger } from '../../../src/utils/logger';

// Mock the BedrockService
jest.mock('../../../src/services/BedrockService', () => ({
  bedrockService: {
    extractEntities: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('NLQRouter with Bedrock', () => {
  let nlqRouter: NLQRouter;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    nlqRouter = new NLQRouter();
    mockLogger = createLogger('test');
    
    // Default mock implementation that returns 'Unknown' intent
    (bedrockService.extractEntities as jest.Mock).mockResolvedValue({
      intent: 'Unknown',
    });
  });

  describe('processQuery with Bedrock', () => {
    it('should use Bedrock results when intent is found', async () => {
      // Mock Bedrock to return a valid intent
      (bedrockService.extractEntities as jest.Mock).mockResolvedValueOnce({
        intent: 'RecommendRestaurant',
        cuisine: 'italian',
        location: 'downtown',
        budget: true
      });

      const result = await nlqRouter.processQuery('Find me an Italian restaurant in downtown');
      
      expect(result).toEqual({
        action: 'RecommendRestaurant',
        entities: {
          cuisine: 'italian',
          location: 'downtown',
          budget: true
        }
      });
      
      // Verify Bedrock was called
      expect(bedrockService.extractEntities).toHaveBeenCalledWith('Find me an Italian restaurant in downtown');
      
      // Should not fall back to rule-based processing
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processed with Bedrock', 
        expect.objectContaining({
          query: 'Find me an Italian restaurant in downtown',
          result: expect.objectContaining({
            action: 'RecommendRestaurant'
          })
        })
      );
    });

    it('should fall back to rule-based processing when Bedrock returns Unknown intent', async () => {
      // Mock Bedrock to return Unknown intent
      (bedrockService.extractEntities as jest.Mock).mockResolvedValueOnce({
        intent: 'Unknown'
      });

      const result = await nlqRouter.processQuery('What should I have for breakfast?');
      
      // Should fall back to rule-based processing
      expect(result.action).toBe('RecommendMeal');
      expect(result.entities.mealType).toBe('breakfast');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processed with rules', 
        expect.anything()
      );
    });

    it('should handle Bedrock errors and fall back to rule-based processing', async () => {
      // Mock Bedrock to throw an error
      (bedrockService.extractEntities as jest.Mock).mockRejectedValueOnce(
        new Error('Bedrock API error')
      );

      const result = await nlqRouter.processQuery('Find me a restaurant');
      
      // Should fall back to rule-based processing
      expect(result.action).toBe('RecommendRestaurant');
      
      // Should log the error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error processing with Bedrock, falling back to rules', 
        expect.objectContaining({
          error: 'Bedrock API error',
          query: 'Find me a restaurant'
        })
      );
    });
  });

  describe('processWithBedrock', () => {
    it('should map Bedrock entities to NLQResult format', async () => {
      // Mock Bedrock response
      (bedrockService.extractEntities as jest.Mock).mockResolvedValueOnce({
        intent: 'RecommendDish',
        dishName: 'pasta carbonara',
        cuisine: 'italian',
        quick: true
      });

      // @ts-ignore - Accessing private method for testing
      const result = await nlqRouter.processWithBedrock('Tell me about pasta carbonara');
      
      expect(result).toEqual({
        action: 'RecommendDish',
        entities: {
          dishName: 'pasta carbonara',
          cuisine: 'italian',
          quick: true
        }
      });
    });

    it('should handle empty Bedrock response', async () => {
      // Mock empty Bedrock response
      (bedrockService.extractEntities as jest.Mock).mockResolvedValueOnce({});

      // @ts-ignore - Accessing private method for testing
      const result = await nlqRouter.processWithBedrock('Random query');
      
      expect(result).toEqual({
        action: 'Unknown',
        entities: {}
      });
    });
  });
});
