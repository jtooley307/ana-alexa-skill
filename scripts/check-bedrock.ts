import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkBedrockAccess() {
  try {
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-west-2',
    });

    // Try to invoke a simple operation to check access
    const response = await client.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-v2',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: '\n\nHuman: Hello!\n\nAssistant:',
        max_tokens_to_sample: 20,
      }),
    }));
    
    const responseText = new TextDecoder().decode(response.body);
    console.log('✅ Successfully connected to Amazon Bedrock');
    console.log('Test response:', responseText);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Amazon Bedrock:', error);
    return false;
  }
}

// Run the check
checkBedrockAccess().then(success => {
  process.exit(success ? 0 : 1);
});
