import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createLogger } from '../utils/logger';

const logger = createLogger('preferences-service');

export interface UserPreferences {
  userId: string;
  favoriteDish?: string;
  preferredMealType?: 'breakfast' | 'lunch' | 'dinner';
  favoriteRestaurant?: string;
  lastUpdated?: string;
  // Add more preferences as needed
}

export class PreferencesService {
  private tableName: string;
  private dynamoDbClient: DynamoDBClient;

  constructor() {
    // Trim any whitespace from the table name to avoid validation errors
    this.tableName = (process.env.PREFERENCES_TABLE_NAME || 'AlexaUserPreferences').trim();
    
    if (!this.tableName) {
      throw new Error('PREFERENCES_TABLE_NAME environment variable is required');
    }
    
    this.dynamoDbClient = new DynamoDBClient({
      region: (process.env.AWS_REGION || 'us-west-2').trim(),
      // Enable HTTP keep-alive for better performance
      maxAttempts: 3,
      retryMode: 'standard',
    });
    
    logger.info(`Initialized PreferencesService with table: ${this.tableName}`);
  }

  /**
   * Get user preferences
   * @param userId The user ID from Alexa
   * @returns User preferences or null if not found
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId }),
      });

      const { Item } = await this.dynamoDbClient.send(command);
      
      if (!Item) {
        return null;
      }

      return unmarshall(Item) as UserPreferences;
    } catch (error) {
      logger.error('Failed to get user preferences', error as Error, { userId });
      throw new Error('Failed to retrieve user preferences');
    }
  }

  /**
   * Save or update user preferences
   * @param preferences User preferences to save
   * @returns The saved preferences
   */
  async savePreferences(preferences: Partial<UserPreferences> & { userId: string }): Promise<UserPreferences> {
    try {
      const now = new Date().toISOString();
      const userId = preferences.userId;
      
      // Get existing preferences to merge
      const existingPrefs = await this.getPreferences(userId) || {};
      
      // Merge preferences
      const updatedPrefs: UserPreferences = {
        ...existingPrefs,
        ...preferences,
        lastUpdated: now,
        userId, // Ensure userId is always set
      };

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(updatedPrefs, { removeUndefinedValues: true }),
      });

      await this.dynamoDbClient.send(command);
      
      logger.info('Successfully saved user preferences', { userId });
      return updatedPrefs;
    } catch (error) {
      logger.error('Failed to save user preferences', error as Error, { userId: preferences.userId });
      throw new Error('Failed to save user preferences');
    }
  }

  /**
   * Update specific user preferences
   * @param userId The user ID from Alexa
   * @param updates Object containing the fields to update
   * @returns The updated preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'userId' | 'lastUpdated'>>
  ): Promise<UserPreferences> {
    try {
      const now = new Date().toISOString();
      
      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};
      
      Object.entries(updates).forEach(([key, value], index) => {
        if (value !== undefined) {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          
          updateExpressions.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        }
      });
      
      // Add last updated timestamp
      updateExpressions.push('#lastUpdated = :lastUpdated');
      expressionAttributeNames['#lastUpdated'] = 'lastUpdated';
      expressionAttributeValues[':lastUpdated'] = now;
      
      const command = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW',
      });
      
      const { Attributes } = await this.dynamoDbClient.send(command);
      
      if (!Attributes) {
        throw new Error('No attributes returned after update');
      }
      
      return unmarshall(Attributes) as UserPreferences;
    } catch (error) {
      logger.error('Failed to update user preferences', error as Error, { userId });
      throw new Error('Failed to update user preferences');
    }
  }
}

// Singleton instance
export const preferencesService = new PreferencesService();
