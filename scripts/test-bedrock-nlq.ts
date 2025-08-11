import { NLQRouter } from '../src/services/NLQRouter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testQueries = [
  "Find me a cheap Italian restaurant near downtown",
  "What's a good breakfast option?",
  "I'm in the mood for some spicy Thai food",
  "Recommend a healthy lunch option",
  "What's a good dish for dinner with chicken?",
  "Find me a quick bite to eat",
  "I want to try something new for dinner"
];

async function testNLQWithBedrock() {
  const nlqRouter = new NLQRouter();
  
  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    try {
      const result = await nlqRouter.processQuery(query);
      console.log('🔍 Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }
    console.log('─'.repeat(80));
  }
}

testNLQWithBedrock().catch(console.error);
