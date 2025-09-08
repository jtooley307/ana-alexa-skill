import { HandlerInput } from 'ask-sdk-core';
import { Response, IntentRequest } from 'ask-sdk-model';
import { BaseHandler } from '../handlers/BaseHandler';
import { apiClient } from '../services/ApiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('GetRecipeIntent');

export class GetRecipeIntentHandler extends BaseHandler {
  static isApplicable(handlerInput: HandlerInput): boolean {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && 
           (request as IntentRequest).intent.name === 'GetRecipeIntent';
  }

  // Removed DynamoDB normalization in favor of Recipe API only

  canHandle(handlerInput: HandlerInput): boolean {
    return GetRecipeIntentHandler.isApplicable(handlerInput);
  }

  async handle(handlerInput: HandlerInput): Promise<Response> {
    this.logRequest(handlerInput, 'Handling GetRecipeIntent');
    
    try {
      const userId = this.getUserId(handlerInput);
      const request = handlerInput.requestEnvelope.request as IntentRequest;
      const { slots } = request.intent;
      
      // Get dish name from slot or session attributes (from previous dish recommendation)
      const dishName = (slots?.dishName?.value as string) || 
                      handlerInput.attributesManager.getSessionAttributes()?.lastRecommendedDish ||
                      '';
      if (!dishName) {
        const prompt = 'What dish would you like a recipe for? For example, chicken curry, pasta primavera, or tiramisu.';
        return handlerInput.responseBuilder
          .speak(prompt)
          .reprompt(prompt)
          .withSimpleCard('Get a Recipe', 'Please tell me the dish you want a recipe for. For example: chicken curry, pasta primavera, or tiramisu.')
          .withShouldEndSession(false)
          .getResponse();
      }
      
      logger.info('Fetching recipe for dish', { userId, dishName });
      
      // Prefer direct recipe lookup by Recipe API id if available
      const session = handlerInput.attributesManager.getSessionAttributes() || {} as any;
      const recipeId = (session.lastRecipeId || '').toString().trim();
      let recipe: any | null = null;
      if (recipeId) {
        logger.info('Attempting direct recipe lookup by id', { recipeId });
        // Try describe to ensure details
        const described = await apiClient.describeRecipe(recipeId);
        if (described?.data?.recipe) {
          recipe = described.data.recipe;
        } else {
          // Fallback to external API by id
          const byId = await apiClient.getRecipeById(recipeId);
          if (byId?.data) {
            recipe = (byId as any).data?.recipe || (byId as any).data?.recipes?.[0] || (byId as any).data;
          }
        }
      }

      // Fallback to name-based search if no recipe found via id
      if (!recipe) {
        // Always use Recipe API search by name per spec
        recipe = await this.getRecipe(dishName);
      }
      
      if (!recipe) {
        return this.handleNoRecipeFound(handlerInput, dishName);
      }
      
      // If recipe is missing ingredients/instructions, enrich via describe
      try {
        const candidateId = (recipe.id || recipe.recipe_id || recipe?.recipe?.id || '').toString();
        const hasIngredients = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
        const hasInstructions = Array.isArray(recipe.instructions) && recipe.instructions.length > 0;
        logger.info('Pre-enrichment recipe keys', { keys: Object.keys(recipe || {}), hasIngredients, hasInstructions, candidateId });
        if (candidateId) {
          const desc = await apiClient.describeRecipe(candidateId);
          if (desc?.data?.recipe) {
            const detailed = desc.data.recipe;
            recipe = {
              ...recipe,
              ...detailed,
              // Prefer arrays if available after enrichment
              ingredients: detailed.ingredients || recipe.ingredients,
              instructions: detailed.instructions || detailed.directions || recipe.instructions,
            };
            const hasIng2 = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
            const hasInst2 = Array.isArray(recipe.instructions) && recipe.instructions.length > 0;
            logger.info('Post-enrichment recipe keys', { keys: Object.keys(recipe || {}), hasIngredients: hasIng2, hasInstructions: hasInst2 });
          }
        }
      } catch (e) {
        logger.warn('Recipe enrichment via describe failed', { error: (e as Error)?.message });
      }
      
      // Store Recipe API id for follow-ups if available
      try {
        const chosenId = (recipe.id || recipe.recipe_id || recipe?.recipe?.id || '').toString();
        if (chosenId) {
          handlerInput.attributesManager.setSessionAttributes({
            ...session,
            lastRecipeId: chosenId,
          });
          logger.info('Stored lastRecipeId in session', { lastRecipeId: chosenId });
        }
      } catch {}

      // Build response
      const speechText = this.buildRecipeResponse(recipe, dishName);
      const cardText = this.buildRecipeCardText(recipe, dishName);

      // Fetch and store list of top recipes for Next flow
      try {
        const listResp = await apiClient.getRecipes({ dish: dishName.toLowerCase(), limit: 5 });
        const list = (listResp.data && (listResp.data as any).recipes) || [];
        const chosenId = (recipe.id || recipe.recipe_id || recipe?.recipe?.id || '').toString();
        const idx = chosenId ? list.findIndex((r: any) => (r.id || r.recipe_id || r?.recipe?.id || '').toString() === chosenId) : 0;
        const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {} as any;
        sessionAttrs.recipeRecommendations = list;
        sessionAttrs.recipeIndex = idx >= 0 ? idx : 0;
        sessionAttrs.lastDishForRecipes = dishName;
        handlerInput.attributesManager.setSessionAttributes(sessionAttrs);
      } catch (_) {
        // non-fatal
      }
      
      return handlerInput.responseBuilder
        .speak(speechText + ' If you want another option, say next recipe.')
        .withSimpleCard('Recipe Instructions', cardText)
        .withShouldEndSession(false)
        .reprompt('Say next recipe for another option, or ask me to find a restaurant that serves it.')
        .getResponse();
      
    } catch (error) {
      this.logError(error as Error, handlerInput);
      return this.handleError(handlerInput, error as Error);
    }
  }
  
  private async getRecipe(dishName: string, excludeId?: string): Promise<any> {
    try {
      const dish = (dishName || '').toLowerCase();
      const limit = 5; // within 1-10 as per API spec, fetch a few to pick best

      logger.info('Fetching recipe with params', { dish, limit });

      // Primary request uses the preferred key 'dish'
      let response = await apiClient.getRecipes({ dish, limit });
      logger.info('Recipe API Response received', {
        hasData: !!response.data,
        resultCount: response.data?.recipes?.length || 0
      });

      if (response.error) {
        logger.warn('Error from Recipe API', { error: response.error });
        return null;
      }

      let recipes = (response.data && response.data.recipes) || [];
      if (!Array.isArray(recipes) || recipes.length === 0) {
        logger.warn('No recipes found in response data.recipes, retrying with dish_name alias');
        // Fallback: try alias 'dish_name'
        response = await apiClient.getRecipes({ dish: dish, limit });
        recipes = (response.data && response.data.recipes) || [];
        if (!Array.isArray(recipes) || recipes.length === 0) {
          return null;
        }
      }

      // Choose a recipe that has content or an id; randomize; try to avoid repeating lastRecipeId
      const hasInstr = (r: any) => !!(r?.instructions || r?.steps || r?.directions || r?.method || r?.recipe?.instructions || r?.directions_text || r?.instructions_text || r?.preparation || r?.procedure);
      const hasIngr = (r: any) => !!(r?.ingredients || r?.ingredientLines || r?.ingredients_list || r?.ingredient_list || r?.recipe?.ingredients || r?.ingredients_text || r?.ingredientsRaw || r?.ingredients_raw);
      const getId = (r: any) => (r?.id || r?.recipe_id || r?.recipe?.id || '').toString();
      let candidates = recipes.filter((r: any) => hasInstr(r) || hasIngr(r) || getId(r));
      if (excludeId) {
        candidates = candidates.filter((r: any) => getId(r) !== excludeId);
      }
      if (!candidates.length) candidates = recipes;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const recipe = pick;
      const keys = Object.keys(recipe || {});
      logger.info('Found recipe', { 
        recipeName: recipe.name || recipe.title,
        hasInstructions: !!(recipe.instructions || recipe.steps || recipe.directions || recipe.method || recipe?.recipe?.instructions || recipe.directions_text || recipe.instructions_text || recipe.preparation || recipe.procedure),
        hasIngredients: !!(recipe.ingredients || recipe.ingredientLines || recipe.ingredients_list || recipe.ingredient_list || recipe?.recipe?.ingredients || recipe.ingredients_text || recipe.ingredientsRaw || recipe.ingredients_raw),
        availableKeys: keys
      });
      
      return recipe;
    } catch (error) {
      const errorObj = error as Error;
      logger.error('Error in getRecipe', errorObj);
      return null;
    }
  }
  
  private buildRecipeResponse(recipe: any, dishName: string): string {
    const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
    const toLines = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((x: any) => typeof x === 'string' ? x : (x?.instruction || x?.instruction_text || x?.step || x?.text || x?.name)).filter(Boolean);
      if (typeof v === 'string') {
        const cleaned = stripHtml(v);
        // split by newlines or numbered/bulleted patterns
        return cleaned.split(/\r?\n+|\s*\d+\.|\s*•|\s*-\s+/).map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    let speechText = `Here's how to make ${recipe.name || recipe.title || dishName}. `;
    
    // Add preparation time if available
    if (recipe.prep_time || recipe.prepTime) {
      const prepTime = recipe.prep_time || recipe.prepTime;
      speechText += `This recipe takes about ${prepTime} to prepare. `;
    }
    
    // Add cooking time if available
    if (recipe.cook_time || recipe.cookTime) {
      const cookTime = recipe.cook_time || recipe.cookTime;
      speechText += `Cooking time is ${cookTime}. `;
    }
    
    // Add servings if available
    if (recipe.servings || recipe.serves) {
      const servings = recipe.servings || recipe.serves;
      speechText += `This recipe serves ${servings}. `;
    }
    
    // Add brief ingredient overview
    if (recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      const ingredientCount = recipe.ingredients.length;
      speechText += `You'll need ${ingredientCount} main ingredients. `;
    }
    
    // Add first few cooking steps (normalize various fields)
    const instructionCandidates = 
      recipe.instructions || recipe.steps || recipe.directions || recipe.method || 
      recipe?.recipe?.instructions || recipe.directions_text || recipe.instructions_text || 
      recipe.preparation || recipe.procedure;
    const instructions = toLines(instructionCandidates);
    if (instructions.length > 0) {
        speechText += `Here are the first few steps: `;
        const firstSteps = instructions.slice(0, 3);
        firstSteps.forEach((step: string, index: number) => {
          if (step) speechText += `Step ${index + 1}: ${step}. `;
        });
        
        if (instructions.length > 3) speechText += `There are ${instructions.length - 3} more steps. `;
    }
    
    speechText += 'Would you like me to find a restaurant that serves this dish, or would you like another recipe recommendation?';
    
    return speechText;
  }
  
  private buildRecipeCardText(recipe: any, dishName: string): string {
    const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
    const toLines = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((x: any) => typeof x === 'string' ? x : (x?.instruction || x?.instruction_text || x?.step || x?.text || x?.name || x?.ingredient_text || x?.normalized_ingredient)).filter(Boolean);
      if (typeof v === 'string') {
        const cleaned = stripHtml(v);
        return cleaned.split(/\r?\n+|\s*\d+\.|\s*•|\s*\-\s+|;\s*/).map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    let cardText = `Recipe for ${recipe.name || recipe.title || dishName}\n\n`;
    
    // Add description/summary at the top if available
    if (recipe.description || recipe.summary) {
      const desc = stripHtml((recipe.description || recipe.summary).toString());
      if (desc) {
        cardText += `Description: ${desc}\n\n`;
      }
    }

    // Add timing information
    if (recipe.prep_time || recipe.prepTime) {
      cardText += `Prep Time: ${recipe.prep_time || recipe.prepTime}\n`;
    }
    if (recipe.cook_time || recipe.cookTime) {
      cardText += `Cook Time: ${recipe.cook_time || recipe.cookTime}\n`;
    }
    if (recipe.servings || recipe.serves) {
      cardText += `Serves: ${recipe.servings || recipe.serves}\n`;
    }
    cardText += '\n';
    
    // Add ingredients (support multiple possible fields)
    const ingredientsRaw = recipe.ingredients || recipe.ingredientLines || recipe.ingredients_list || recipe.ingredient_list || recipe?.recipe?.ingredients || recipe.ingredients_text || recipe.ingredientsRaw || recipe.ingredients_raw;
    cardText += 'INGREDIENTS:\n';
    if (ingredientsRaw) {
      let ingLines = toLines(ingredientsRaw);
      if (ingLines.length) {
        ingLines.forEach((p: string) => { cardText += `• ${p}\n`; });
      } else {
        cardText += '(Not available)\n';
      }
    } else {
      cardText += '(Not available)\n';
    }
    cardText += '\n';
    
    // Add instructions (support multiple possible fields)
    const instructionsRaw = recipe.instructions || recipe.steps || recipe.directions || recipe.method || recipe?.recipe?.instructions || recipe.directions_text || recipe.instructions_text || recipe.preparation || recipe.procedure;
    // If array of objects with step_number/instruction_text, sort then map
    let instLines: string[] = [];
    if (Array.isArray(instructionsRaw) && instructionsRaw.length && typeof instructionsRaw[0] === 'object' && (instructionsRaw[0].step_number || instructionsRaw[0].instruction_text)) {
      const sorted = [...instructionsRaw].sort((a: any, b: any) => (a.step_number ?? a.order ?? 0) - (b.step_number ?? b.order ?? 0));
      instLines = sorted.map((s: any) => String(s.instruction_text || s.instruction || s.text || s.step || '').trim()).filter(Boolean);
    } else {
      instLines = toLines(instructionsRaw);
    }
    cardText += 'INSTRUCTIONS:\n';
    if (instLines && instLines.length) {
      instLines.forEach((step: string, index: number) => { cardText += `${index + 1}. ${step}\n`; });
    } else {
      cardText += '(Not available)\n';
    }
    
    return cardText.trim();
  }
  
  private handleNoRecipeFound(handlerInput: HandlerInput, dishName: string): Response {
    const speechText = `I'm sorry, I couldn't find a recipe for ${dishName}. Would you like me to recommend a different dish or find a restaurant that serves ${dishName}?`;
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('You can say "recommend another dish" or "find a restaurant"')
      .withSimpleCard('No Recipe Found', speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
  
  private handleError(handlerInput: HandlerInput, error: Error): Response {
    logger.error('Error in GetRecipeIntent', error);
    
    const speechText = 'I had trouble finding a recipe. Please try again later.';
    
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error', speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}
