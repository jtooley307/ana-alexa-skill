import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class CancelAndStopHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           (request.intent.name === 'AMAZON.CancelIntent' || 
            request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.NoIntent');
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Cancel/Stop/No intent received');
    
    const speechText = 'Goodbye! Hope you enjoy your meal!';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Goodbye!', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
