import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class HelpHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'AMAZON.HelpIntent';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Help intent received');
    
    const helpMessage = `
      I can help you with food and restaurant recommendations. Here are some things you can ask me:
      - "Recommend a dinner dish"
      - "What should I have for lunch?"
      - "Find me an Italian restaurant in Seattle"
      - "Save my favorite dish as pizza"
      - "I prefer Italian food"
      
      You can also ask me in natural language like "What's a good breakfast place nearby?"
      
      What would you like to do?
    `;
    
    const repromptMessage = 'Try asking for a dish recommendation or tell me what kind of food you like.';
    
    return handlerInput.responseBuilder
      .speak(helpMessage)
      .reprompt(repromptMessage)
      .withSimpleCard('Ana Help', helpMessage)
      .getResponse();
  }
}
