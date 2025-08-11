import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class FallbackHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           request.intent.name === 'AMAZON.FallbackIntent';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Fallback intent received');
    
    const speechText = `
      I'm not sure I understand. You can ask me to recommend a dish, 
      suggest a meal, or find a restaurant. For example, try saying 
      'recommend a dinner place' or 'what should I have for lunch?'
    `;
    
    const repromptText = 'How can I help you with food or restaurant recommendations?';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('Sorry, I didn\'t get that', speechText)
      .getResponse();
  }
}
