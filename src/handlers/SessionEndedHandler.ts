import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class SessionEndedHandler extends BaseHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Session ended');
    
    // Any cleanup logic goes here
    const request = handlerInput.requestEnvelope.request as any;
    if (request.reason) {
      console.log(`Session ended with reason: ${request.reason}`);
      if (request.error) {
        console.error(`Error details: ${JSON.stringify(request.error)}`);
      }
    }
    
    // Since the session is ending, we don't send a response
    return handlerInput.responseBuilder.getResponse();
  }
}
