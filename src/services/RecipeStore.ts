import { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createLogger } from '../utils/logger';

const logger = createLogger('recipe-store');

const DEFAULT_REGION = (process.env.AWS_REGION || 'us-west-2').trim();
const RECIPES_TABLE = process.env.RECIPES_TABLE || 'RestaurantMenuScraper-Recipes-V2';
const STEPS_TABLE = process.env.RECIPE_STEPS_TABLE || 'RestaurantMenuScraper-RecipeSteps-V2';
const ING_TABLE = process.env.RECIPE_ING_TABLE || 'RestaurantMenuScraper-RecipeIngredients-V2';

export interface NormalizedRecipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string | number;
  description?: string;
}

export class RecipeStore {
  private client: DynamoDBClient;

  constructor() {
    this.client = new DynamoDBClient({ region: DEFAULT_REGION });
  }

  public async getById(recipeId: string): Promise<NormalizedRecipe | null> {
    try {
      const rec = await this.getRecipeRecord(recipeId);
      if (!rec) return null;
      const [steps, ings] = await Promise.all([
        this.getSteps(recipeId),
        this.getIngredients(recipeId),
      ]);
      return this.normalize(rec, steps, ings);
    } catch (e) {
      logger.error('getById failed', e as Error, { recipeId });
      return null;
    }
  }

  public async searchByName(name: string, limit = 5): Promise<NormalizedRecipe | null> {
    const title = (name || '').trim();
    if (!title) return null;

    try {
      // 1) Try title-index equality (fast)
      const res = await this.client.send(new QueryCommand({
        TableName: RECIPES_TABLE,
        IndexName: 'title-index',
        KeyConditionExpression: '#t = :t',
        ExpressionAttributeNames: { '#t': 'title' },
        ExpressionAttributeValues: marshall({ ':t': title }),
        Limit: 1,
      }));
      const item = res.Items?.[0] ? unmarshall(res.Items[0]) : undefined;
      if (item?.recipe_id) {
        return this.getById(String(item.recipe_id));
      }

      // 2) Fallback scan with contains(title, :t) limited to a small page
      const scan = await this.client.send(new ScanCommand({
        TableName: RECIPES_TABLE,
        FilterExpression: 'contains(#t, :t)',
        ExpressionAttributeNames: { '#t': 'title' },
        ExpressionAttributeValues: marshall({ ':t': title }),
        Limit: limit,
      }));
      const first = scan.Items?.[0] ? unmarshall(scan.Items[0]) : undefined;
      if (first?.recipe_id) {
        return this.getById(String(first.recipe_id));
      }
    } catch (e) {
      logger.error('searchByName failed', e as Error, { title });
    }
    return null;
  }

  private async getRecipeRecord(recipeId: string): Promise<any | null> {
    const out = await this.client.send(new GetItemCommand({
      TableName: RECIPES_TABLE,
      Key: marshall({ recipe_id: recipeId }),
    }));
    return out.Item ? unmarshall(out.Item) : null;
  }

  private async getSteps(recipeId: string): Promise<string[]> {
    // Query GSI recipe_id-index on steps table
    const res = await this.client.send(new QueryCommand({
      TableName: STEPS_TABLE,
      IndexName: 'recipe_id-index',
      KeyConditionExpression: '#rid = :rid',
      ExpressionAttributeNames: { '#rid': 'recipe_id' },
      ExpressionAttributeValues: marshall({ ':rid': recipeId }),
    }));
    const items = (res.Items || []).map(i => unmarshall(i));
    // Common fields: text, instruction, step_text, description; also numeric order may exist
    const steps = items
      .sort((a, b) => (a.step_number ?? a.order ?? 0) - (b.step_number ?? b.order ?? 0))
      .map((s: any) => String(s.text || s.instruction || s.step_text || s.description || '').trim())
      .filter(Boolean);
    return steps;
  }

  private async getIngredients(recipeId: string): Promise<string[]> {
    const res = await this.client.send(new QueryCommand({
      TableName: ING_TABLE,
      IndexName: 'recipe_id-index',
      KeyConditionExpression: '#rid = :rid',
      ExpressionAttributeNames: { '#rid': 'recipe_id' },
      ExpressionAttributeValues: marshall({ ':rid': recipeId }),
    }));
    const items = (res.Items || []).map(i => unmarshall(i));
    const ings = items
      .map((ing: any) => String(ing.name || ing.normalized_ingredient || ing.ingredient || '').trim())
      .filter(Boolean);
    return ings;
  }

  private normalize(rec: any, steps: string[], ings: string[]): NormalizedRecipe {
    return {
      id: String(rec.recipe_id || rec.id || ''),
      title: String(rec.title || rec.name || 'Recipe'),
      ingredients: ings,
      instructions: steps,
      prepTime: rec.prep_time || rec.prepTime,
      cookTime: rec.cook_time || rec.cookTime,
      servings: rec.servings || rec.serves,
      description: rec.description || rec.summary,
    };
  }
}

export const recipeStore = new RecipeStore();
