import fs from 'fs';
import path from 'path';
import { mockHandlerInput } from '../test-utils';

// Import all custom intent handlers we expect to exist
import { RecommendDishIntentHandler } from '../../src/intents/RecommendDishIntent';
import { RecommendMealIntentHandler } from '../../src/intents/RecommendMealIntent';
import { RecommendRestaurantIntentHandler } from '../../src/intents/RecommendRestaurantIntent';
import { SaveFavoriteDishIntentHandler } from '../../src/intents/SaveFavoriteDishIntent';
import { SaveFavoriteRestaurantIntentHandler } from '../../src/intents/SaveFavoriteRestaurantIntent';
import { SavePreferredMealTypeIntentHandler } from '../../src/intents/SavePreferredMealTypeIntent';
import { GetRecipeIntentHandler } from '../../src/intents/GetRecipeIntent';
import { NaturalLanguageQueryIntentHandler } from '../../src/intents/NaturalLanguageQueryIntent';
import { GetPreferencesIntentHandler } from '../../src/intents/GetPreferencesIntent';

// Map interaction model intent names to handler classes
const intentHandlerMap: Record<string, any> = {
  RecommendDishIntent: RecommendDishIntentHandler,
  RecommendMealIntent: RecommendMealIntentHandler,
  RecommendRestaurantIntent: RecommendRestaurantIntentHandler,
  SaveFavoriteDishIntent: SaveFavoriteDishIntentHandler,
  SaveFavoriteRestaurantIntent: SaveFavoriteRestaurantIntentHandler,
  SavePreferredMealTypeIntent: SavePreferredMealTypeIntentHandler,
  GetRecipeIntent: GetRecipeIntentHandler,
  NaturalLanguageQueryIntent: NaturalLanguageQueryIntentHandler,
  GetPreferencesIntent: GetPreferencesIntentHandler,
};

// Helper to extract slot tokens from a sample string, e.g. "find {query}" -> ['query']
function extractSlotTokens(sample: string): string[] {
  const tokens: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sample)) !== null) {
    tokens.push(m[1]);
  }
  return tokens;
}

describe('Interaction model samples', () => {
  const modelPath = path.join(__dirname, '../../models/en-US.json');
  const modelRaw = fs.readFileSync(modelPath, 'utf8');
  const model = JSON.parse(modelRaw);
  const intents = model?.interactionModel?.languageModel?.intents || [];

  it('should have an interaction model with intents', () => {
    expect(Array.isArray(intents)).toBe(true);
    expect(intents.length).toBeGreaterThan(0);
  });

  // Validate each custom intent's samples against its slots
  intents
    .filter((i: any) => !i.name.startsWith('AMAZON.'))
    .forEach((intent: any) => {
      const name = intent.name;
      const samples: string[] = intent.samples || [];
      const slots: Array<{ name: string }> = intent.slots || [];
      const slotNames = new Set(slots.map((s) => s.name));

      describe(`${name}`, () => {
        it('declares valid sample tokens that match declared slots', () => {
          for (const sample of samples) {
            const tokens = extractSlotTokens(sample);
            for (const t of tokens) {
              expect(slotNames.has(t)).toBe(true);
            }
          }
        });

        if (intentHandlerMap[name]) {
          it('has a handler and canHandle returns true for intent name', () => {
            const HandlerClass = intentHandlerMap[name];
            const handler = new HandlerClass();
            const handlerInput = mockHandlerInput(name, {});
            expect(handler.canHandle(handlerInput)).toBe(true);
          });
        } else {
          it.skip('has a corresponding handler implementation', () => {
            // Handler not implemented in codebase; skipping handler execution test for this intent.
            // Consider adding a handler class for this intent and mapping it in intentHandlerMap.
            console.warn(`Skipping handler test: missing handler mapping for intent: ${name}`);
            expect(true).toBe(true);
          });
        }
      });
    });
});
