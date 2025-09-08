import { NextRecipeIntentHandler } from '../../src/intents/NextRecipeIntent';
import { mockHandlerInput } from '../test-utils';

describe('NextRecipeIntentHandler', () => {
  it('informs when there are no saved recipe options', async () => {
    const handler = new NextRecipeIntentHandler();
    const hi: any = mockHandlerInput('NextRecipeIntent', {});
    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining("I don't have more recipes saved yet")
    );
  });

  it('advances to the next recipe and updates index', async () => {
    const handler = new NextRecipeIntentHandler();
    const hi: any = mockHandlerInput('NextRecipeIntent', {});

    const session = {
      recipeRecommendations: [
        { name: 'Recipe A', ingredients: ['A'], instructions: ['Step'] },
        { name: 'Recipe B', ingredients: ['B'], instructions: ['Step'] },
      ],
      recipeIndex: 0,
    };

    const getSessionSpy = jest.spyOn(hi.attributesManager, 'getSessionAttributes').mockReturnValue(session);
    const setSessionSpy = jest.spyOn(hi.attributesManager, 'setSessionAttributes').mockImplementation((attrs: any) => Object.assign(session, attrs));

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Recipe B')
    );
    expect(session.recipeIndex).toBe(1);

    getSessionSpy.mockRestore();
    setSessionSpy.mockRestore();
  });

  it('handles when user reaches the end of recipe list', async () => {
    const handler = new NextRecipeIntentHandler();
    const hi: any = mockHandlerInput('NextRecipeIntent', {});

    const session = {
      recipeRecommendations: [{ name: 'Only One', ingredients: ['X'] }],
      recipeIndex: 0,
    };

    jest.spyOn(hi.attributesManager, 'getSessionAttributes').mockReturnValue(session);

    const resp = await handler.handle(hi);
    expect(resp).toBeDefined();
    expect(hi.responseBuilder.speak).toHaveBeenCalledWith(
      expect.stringContaining('Those are all the recipes I found')
    );
  });
});
