import { NextOptionIntentHandler } from '../../src/intents/NextOptionIntent';
import { mockHandlerInput } from '../test-utils';

describe('NextOptionIntentHandler', () => {
  it('delegates to restaurant next when restaurant list is present', async () => {
    const handler = new NextOptionIntentHandler();
    const hi: any = mockHandlerInput('AMAZON.NextIntent', {});
    const session = {
      restaurantRecommendations: [{ name: 'A', cuisine: 'X', address: 'Addr' }, { name: 'B', cuisine: 'Y', address: 'Addr2' }],
      restaurantIndex: 0,
    };
    jest.spyOn(hi.attributesManager, 'getSessionAttributes').mockReturnValue(session);

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalled();
  });

  it('delegates to recipe next when recipe list is present', async () => {
    const handler = new NextOptionIntentHandler();
    const hi: any = mockHandlerInput('AMAZON.NextIntent', {});
    const session = {
      recipeRecommendations: [{ name: 'R1' }, { name: 'R2' }],
      recipeIndex: 0,
    };
    jest.spyOn(hi.attributesManager, 'getSessionAttributes').mockReturnValue(session);

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalled();
  });

  it('informs when no context to go next on', async () => {
    const handler = new NextOptionIntentHandler();
    const hi: any = mockHandlerInput('AMAZON.NextIntent', {});

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I don't have anything to go next on yet")
    );
  });
});
