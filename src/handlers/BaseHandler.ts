import { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { preferencesService, UserPreferences } from '../services/PreferencesService';
import { logger } from '../utils/logger';

export abstract class BaseHandler implements RequestHandler {
  protected preferencesService = preferencesService;
  
  abstract canHandle(handlerInput: HandlerInput): Promise<boolean> | boolean;
  abstract handle(handlerInput: HandlerInput): Promise<Response>;

  protected logRequest(handlerInput: HandlerInput, message: string): void {
    const requestType = handlerInput.requestEnvelope.request.type;
    const requestId = handlerInput.requestEnvelope.request.requestId;
    const userId = this.getUserId(handlerInput);
    
    logger.info(message, { requestType, requestId, userId });
  }

  protected logError(error: unknown, handlerInput?: HandlerInput): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const context: Record<string, unknown> = {
      requestId: handlerInput?.requestEnvelope.request.requestId,
      userId: handlerInput ? this.getUserId(handlerInput) : undefined,
      intent: (handlerInput?.requestEnvelope.request as any)?.intent?.name,
    };

    // Log the error with context
    logger.error('Error in intent handler', errorObj, context);
  }

  protected getUserId(handlerInput: HandlerInput): string {
    return handlerInput.requestEnvelope.session?.user?.userId || 'anonymous';
  }

  protected async getUserPreferences(handlerInput: HandlerInput): Promise<UserPreferences> {
    const userId = this.getUserId(handlerInput);
    try {
      const preferences = await this.preferencesService.getPreferences(userId);
      return preferences || { userId };
    } catch (error) {
      this.logError(error, handlerInput);
      return { userId };
    }
  }
}
