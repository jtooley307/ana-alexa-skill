import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class LaunchRequestHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'LaunchRequest received');
    
    const welcomeMessage = `
      Welcome to Ana, your food and restaurant recommendation assistant. 
      You can ask me to recommend a dish, suggest a meal, or find a restaurant. 
      For example, try saying 'recommend a dinner place' or 'what should I have for lunch?'
      How can I help you today?
    `;
    
    const repromptMessage = 'You can ask for a dish recommendation, meal suggestion, or restaurant. What would you like?';
    
    return handlerInput.responseBuilder
      .speak(welcomeMessage)
      .reprompt(repromptMessage)
      .withSimpleCard('Welcome to Ana', welcomeMessage)
      .getResponse();
  }
}
