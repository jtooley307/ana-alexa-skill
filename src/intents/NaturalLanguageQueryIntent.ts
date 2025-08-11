import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { nlqRouter } from '../services/NLQRouter';
import { RecommendDishIntentHandler } from './RecommendDishIntent';
import { RecommendMealIntentHandler } from './RecommendMealIntent';
import { RecommendRestaurantIntentHandler } from './RecommendRestaurantIntent';
import { createLogger } from '../utils/logger';

const logger = createLogger('NaturalLanguageQueryIntent');

export class NaturalLanguageQueryIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'NaturalLanguageQueryIntent';
  }

  canHandle(handlerInput: HandlerInput): boolean {
    return NaturalLanguageQueryIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling NaturalLanguageQueryIntent');
    
    try {
      const { slots } = handlerInput.requestEnvelope.request.intent;
      const query = slots?.query?.value;
      
      if (!query) {
        return this.handleNoQuery(handlerInput);
      }
      
      logger.info('Processing natural language query', { query });
      
      // Route the query to the appropriate handler
      const result = await nlqRouter.processQuery(query, handlerInput);
      
      logger.debug('NLQ processing result', { result });
      
      // Delegate to the appropriate intent handler based on the NLQ result
      switch (result.action) {
        case 'RecommendDish':
          return this.delegateToDishIntent(handlerInput, result.entities);
          
        case 'RecommendMeal':
          return this.delegateToMealIntent(handlerInput, result.entities);
          
        case 'RecommendRestaurant':
          return this.delegateToRestaurantIntent(handlerInput, result.entities);
          
        case 'Unknown':
        default:
          return this.handleUnknownQuery(handlerInput, query);
      }
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  private delegateToDishIntent(handlerInput: HandlerInput, entities: any): Promise<Response> {
    const { mealType, cuisine, dishName } = entities;
    
    // Create a new intent request with the extracted entities
    const intentRequest = {
      ...handlerInput.requestEnvelope.request,
      type: 'IntentRequest',
      intent: {
        name: 'RecommendDishIntent',
        confirmationStatus: 'NONE',
        slots: {
          dishName: dishName ? {
            name: 'dishName',
            value: dishName,
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: dishName
            }
          } : undefined,
          mealType: mealType ? {
            name: 'mealType',
            value: mealType,
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: mealType,
              resolutions: {
                resolutionsPerAuthority: [{
                  authority: 'amzn1.er-authority.echo-sdk.amzn1.ask.skill.12345678-1234-1234-1234-123456789012.mealType',
                  status: {
                    code: 'ER_SUCCESS_MATCH'
                  },
                  values: [{
                    value: {
                      name: mealType,
                      id: mealType.toUpperCase()
                    }
                  }]
                }]
              }
            }
          } : undefined,
          cuisine: cuisine ? {
            name: 'cuisine',
            value: cuisine,
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: cuisine
            }
          } : undefined
        }
      }
    };
    
    // Create a new handler input with the modified request
    const newHandlerInput = {
      ...handlerInput,
      requestEnvelope: {
        ...handlerInput.requestEnvelope,
        request: intentRequest
      }
    };
    
    // Delegate to the RecommendDishIntent handler
    return new RecommendDishIntentHandler().handle(newHandlerInput as HandlerInput);
  }
  
  private delegateToMealIntent(handlerInput: HandlerInput, entities: any): Promise<Response> {
    const { mealType, cuisine } = entities;
    
    // Create a new intent request with the extracted entities
    const intentRequest = {
      ...handlerInput.requestEnvelope.request,
      type: 'IntentRequest',
      intent: {
        name: 'RecommendMealIntent',
        confirmationStatus: 'NONE',
        slots: {
          mealTime: {
            name: 'mealTime',
            value: mealType || 'dinner',
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: mealType || 'dinner',
              resolutions: {
                resolutionsPerAuthority: [{
                  authority: 'amzn1.er-authority.echo-sdk.amzn1.ask.skill.12345678-1234-1234-1234-123456789012.mealTime',
                  status: {
                    code: 'ER_SUCCESS_MATCH'
                  },
                  values: [{
                    value: {
                      name: mealType || 'dinner',
                      id: (mealType || 'dinner').toUpperCase()
                    }
                  }]
                }]
              }
            }
          },
          cuisine: cuisine ? {
            name: 'cuisine',
            value: cuisine,
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: cuisine
            }
          } : undefined
        }
      }
    };
    
    // Create a new handler input with the modified request
    const newHandlerInput = {
      ...handlerInput,
      requestEnvelope: {
        ...handlerInput.requestEnvelope,
        request: intentRequest
      }
    };
    
    // Delegate to the RecommendMealIntent handler
    return new RecommendMealIntentHandler().handle(newHandlerInput as HandlerInput);
  }
  
  private delegateToRestaurantIntent(handlerInput: HandlerInput, entities: any): Promise<Response> {
    const { location, cuisine } = entities;
    
    // Create a new intent request with the extracted entities
    const intentRequest = {
      ...handlerInput.requestEnvelope.request,
      type: 'IntentRequest',
      intent: {
        name: 'RecommendRestaurantIntent',
        confirmationStatus: 'NONE',
        slots: {
          city: {
            name: 'city',
            value: location || 'Seattle', // Default to Seattle if no location provided
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: location || 'Seattle'
            }
          },
          cuisine: cuisine ? {
            name: 'cuisine',
            value: cuisine,
            confirmationStatus: 'NONE',
            source: 'USER',
            slotValue: {
              type: 'Simple',
              value: cuisine
            }
          } : undefined
        }
      }
    };
    
    // Create a new handler input with the modified request
    const newHandlerInput = {
      ...handlerInput,
      requestEnvelope: {
        ...handlerInput.requestEnvelope,
        request: intentRequest
      }
    };
    
    // Delegate to the RecommendRestaurantIntent handler
    return new RecommendRestaurantIntentHandler().handle(newHandlerInput as HandlerInput);
  }
  
  private handleNoQuery(handlerInput: HandlerInput): Response {
    const speechText = "I'm sorry, I didn't catch that. Could you please tell me what kind of food or restaurant you're looking for?";
    const repromptText = "You can say something like 'Find me an Italian restaurant' or 'What should I have for dinner?'";
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Need More Information', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleUnknownQuery(handlerInput: HandlerInput, query: string): Response {
    logger.warn('Could not understand query', { query });
    
    const speechText = `I'm not sure how to help with "${query}". You can ask me to recommend a dish, suggest a meal, or find a restaurant. What would you like to do?`;
    const repromptText = 'Try saying something like "Find me a pizza place" or "What should I have for lunch?"';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Not Sure How to Help', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in NaturalLanguageQueryIntent', error);
    
    const speechText = 'I had trouble understanding your request. Please try again.';
    const repromptText = 'You can ask me to recommend a dish, suggest a meal, or find a restaurant.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
}
