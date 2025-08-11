import { SkillBuilders } from 'ask-sdk-core';
import { DynamoDbPersistenceAdapter } from 'ask-sdk-dynamodb-persistence-adapter';
import { RequestEnvelope } from 'ask-sdk-model';
import { ErrorHandler } from './handlers/ErrorHandler';
import { LaunchRequestHandler } from './handlers/LaunchRequestHandler';
import { SessionEndedHandler } from './handlers/SessionEndedHandler';
import { CancelAndStopHandler } from './handlers/CancelAndStopHandler';
import { HelpHandler } from './handlers/HelpHandler';
import { FallbackHandler } from './handlers/FallbackHandler';
import { RecommendDishIntentHandler } from './intents/RecommendDishIntent';
import { RecommendMealIntentHandler } from './intents/RecommendMealIntent';
import { RecommendRestaurantIntentHandler } from './intents/RecommendRestaurantIntent';
import { SaveFavoriteDishIntentHandler } from './intents/SaveFavoriteDishIntent';
import { SavePreferredMealTypeIntentHandler } from './intents/SavePreferredMealTypeIntent';
import { SaveFavoriteRestaurantIntentHandler } from './intents/SaveFavoriteRestaurantIntent';
import { NaturalLanguageQueryIntentHandler } from './intents/NaturalLanguageQueryIntent';

const tableName = process.env.PREFERENCES_TABLE_NAME || 'AlexaUserPreferences';
const isDevelopment = process.env.ENV === 'development';

const persistenceAdapter = new DynamoDbPersistenceAdapter({
  tableName,
  createTable: isDevelopment,
  partitionKeyName: 'userId',
  attributesName: 'attributes',
});

const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    new LaunchRequestHandler(),
    new RecommendDishIntentHandler(),
    new RecommendMealIntentHandler(),
    new RecommendRestaurantIntentHandler(),
    new SaveFavoriteDishIntentHandler(),
    new SavePreferredMealTypeIntentHandler(),
    new SaveFavoriteRestaurantIntentHandler(),
    new NaturalLanguageQueryIntentHandler(),
    new HelpHandler(),
    new CancelAndStopHandler(),
    new FallbackHandler(),
    new SessionEndedHandler()
  )
  .addErrorHandlers(new ErrorHandler());

// Add persistence only in production to avoid DynamoDB costs during development
if (!isDevelopment) {
  skillBuilder.withPersistenceAdapter(persistenceAdapter);
}

const skill = skillBuilder.create();

export const handler = async (event: RequestEnvelope, context: any) => {
  console.log(`Request: ${JSON.stringify(event, null, 2)}`);
  const response = await skill.invoke(event, context);
  console.log(`Response: ${JSON.stringify(response, null, 2)}`);
  return response;
};

// For local testing
if (require.main === module) {
  // This block will only be executed when running locally
  import('dotenv').then(dotenv => {
    dotenv.config();
    console.log('Running in development mode');
  });
}
