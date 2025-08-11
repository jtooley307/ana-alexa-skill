import { HandlerInput, ErrorHandler as AskSdkErrorHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { BaseHandler } from './BaseHandler';

export class ErrorHandler extends BaseHandler implements AskSdkErrorHandler {
  canHandle(): boolean {
    return true; // This handler will be called for all errors
  }

  async handle(handlerInput: HandlerInput, error: Error): Promise<Response> {
    this.logError(error, handlerInput);
    
    const requestType = handlerInput.requestEnvelope.request.type;
    
    let speechText = "I'm sorry, I encountered an error. Please try again later.";
    
    // Provide more specific error messages for certain error types
    if (error.name === 'AskSdk.RequestHandlerError') {
      speechText = "I'm not sure how to handle that request. Please try asking me something else.";
    } else if (error.name === 'TimeoutError') {
      speechText = "I'm having trouble connecting to my services. Please try again in a moment.";
    }
    
    this.logRequest(handlerInput, `Error handled: ${error.message}`);
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('Is there anything else I can help you with?')
      .withSimpleCard('Error', speechText)
      .getResponse();
  }
}
