import { NextRestaurantIntentHandler } from '../../src/intents/NextRestaurantIntent';
import { mockHandlerInput } from '../test-utils';

describe('NextRestaurantIntentHandler', () => {
  it('informs when there are no saved restaurant options', async () => {
    const handler = new NextRestaurantIntentHandler();
    const hi: any = mockHandlerInput('NextRestaurantIntent', {});
    // No recommendations in session by default
    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I don't have more restaurant options saved yet")
    );
  });

  it('advances to the next restaurant and updates index', async () => {
    const handler = new NextRestaurantIntentHandler();
    const hi: any = mockHandlerInput('NextRestaurantIntent', {});

    const session = {
      restaurantRecommendations: [
        { name: 'Option A', cuisine: 'Italian', address: '123 St' },
        { name: 'Option B', cuisine: 'Mexican', address: '456 Ave' },
      ],
      restaurantIndex: 0,
    };

    // Return our session object and make it mutable across setSessionAttributes
    const getSessionSpy = jest
      .spyOn(hi.attributesManager, 'getSessionAttributes')
      .mockReturnValue(session);

    const setSessionSpy = jest.spyOn(hi.attributesManager, 'setSessionAttributes').mockImplementation((attrs: any) => {
      // mutate our local session to reflect new index so we can assert
      Object.assign(session, attrs);
    });

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Option B')
    );
    expect(session.restaurantIndex).toBe(1);
    expect(setSessionSpy).toHaveBeenCalled();

    // Cleanup spies
    getSessionSpy.mockRestore();
    setSessionSpy.mockRestore();
  });

  it('handles when user reaches the end of list', async () => {
    const handler = new NextRestaurantIntentHandler();
    const hi: any = mockHandlerInput('NextRestaurantIntent', {});

    const session = {
      restaurantRecommendations: [{ name: 'Only One', cuisine: 'Cafe', address: '789 Rd' }],
      restaurantIndex: 0,
    };

    jest.spyOn(hi.attributesManager, 'getSessionAttributes').mockReturnValue(session);

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Those are all the options I have right now')
    );
  });
});
