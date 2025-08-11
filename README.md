# Ana - Meal Advisor Skill for Alexa

Ana is an Alexa skill that helps users discover and save their food preferences. It can recommend dishes, meals, and restaurants based on user preferences and natural language queries.

## Features

- **Natural Language Processing**: Understands and processes natural language queries about food and restaurants
- **Personalized Recommendations**: Saves and uses user preferences to provide personalized suggestions
- **Multiple Intents**: Handles various food-related requests including:
  - Dish recommendations
  - Meal suggestions
  - Restaurant recommendations
  - Saving favorites
  - Setting preferences
- **DynamoDB Integration**: Persists user preferences across sessions
- **External API Integration**: Connects with external APIs for dish, meal, and restaurant data
- **Error Handling**: Graceful error handling and user-friendly responses

## Prerequisites

- Node.js 20.x or later
- AWS Account with appropriate permissions
- AWS SAM CLI installed and configured
- An Alexa Developer account

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ana-alexa-skill
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Required for all deployments
PREFERENCES_TABLE_NAME=AlexaUserPreferences
HISTORICAL_API_BASE=<historical-dishes-api-endpoint>
RESTAURANT_API_BASE=<restaurant-api-endpoint>
RECIPE_API_BASE=<recipe-api-endpoint>
AWS_REGION=us-west-2

# Optional: Enable/disable Amazon Bedrock for enhanced NLQ
# Set to 'true' to enable Bedrock for natural language understanding
USE_BEDROCK_NLQ=true

# Required if USE_BEDROCK_NLQ is true
# These are automatically used from your AWS credentials
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key

# Optional: Specify the Bedrock model to use
# Default: anthropic.claude-3-haiku-20240307-v1:0
# BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

### 4. Amazon Bedrock Configuration (Optional)

For enhanced natural language understanding, Ana can use Amazon Bedrock. To enable this:

1. **Enable Bedrock in your AWS account**:
   - Go to the [AWS Management Console](https://console.aws.amazon.com/bedrock/)
   - Request access to the desired foundation models (e.g., Claude 3 Haiku)

2. **Configure IAM permissions**:
   - The deployment template includes the necessary IAM permissions for Bedrock
   - Ensure your IAM user/role has `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions

3. **Environment Variables**:
   - Set `USE_BEDROCK_NLQ=true` in your `.env` file
   - The skill will automatically use your AWS credentials from the environment

4. **Testing Bedrock Integration**:
   ```bash
   # Test Bedrock connectivity (requires AWS credentials)
   npx ts-node scripts/check-bedrock.ts
   
   # Test NLQ with Bedrock
   npx ts-node scripts/test-bedrock-nlq.ts
   ```

### 4. Build the Project

```bash
npm run build
```

### 5. Deploy with AWS SAM

```bash
sam build
sam deploy --guided
```

Follow the interactive prompts to configure the deployment.

### 6. Configure Alexa Skill

1. Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Create a new skill
3. Choose "Custom" model and "Provision your own" backend
4. In the Build tab, upload the interaction model from `models/en-US.json`
5. In the Endpoint tab, select "AWS Lambda ARN" and enter your Lambda function ARN
6. Save and build the model

## Usage Examples

### Basic Commands

- "Alexa, open Meal Advisor"
- "Alexa, ask Meal Advisor to recommend a dish"
- "Alexa, tell Meal Advisor to find me an Italian restaurant"
- "Alexa, ask Meal Advisor what should I have for dinner"

### Saving Preferences

- "Save pizza as my favorite dish"
- "I prefer Italian food"
- "Remember that I love The Cheesecake Factory"
- "Set my preferred meal to lunch"

### Getting Recommendations

- "Recommend a dish for dinner"
- "What's a good Italian dish?"
- "Find me a pizza place in Seattle"
- "What should I eat for breakfast?"

## Project Structure

```
ana-alexa-skill/
├── src/
│   ├── handlers/           # Intent handlers
│   ├── intents/            # Intent implementations
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   └── app.ts              # Main skill entry point
├── models/                 # Alexa interaction models
├── test/                   # Test files
├── template.yaml           # AWS SAM template
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Testing

### Run Tests

Run the test suite with:

```bash
npm test
```

### Local Testing

You can test the skill locally without deploying to AWS using the local testing script:

```bash
npx ts-node scripts/test-locally.ts
```

This will start an interactive session where you can test different intents and see the responses.

## Deployment

### Manual Deployment

To deploy updates manually:

```bash
# Build the project
npm run build

# Build and package with SAM
sam build

# Deploy to AWS
sam deploy
```

### CI/CD Pipeline

This project includes a GitHub Actions workflow that automates testing and deployment:

1. On every push to `main` branch:
   - Runs tests
   - Builds the application
   - Deploys to AWS (if tests pass)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions, including required environment variables and AWS configuration.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, please open an issue in the GitHub repository.

## Acknowledgements

- [Alexa Skills Kit](https://developer.amazon.com/en-US/alexa/alexa-skills-kit)
- [AWS SDK for JavaScript](https://aws.amazon.com/sdk-for-javascript/)
- [TypeScript](https://www.typescriptlang.org/)
