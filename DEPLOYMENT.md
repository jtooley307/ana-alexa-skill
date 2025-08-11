# Deployment Guide for Ana Alexa Skill

This guide provides step-by-step instructions for deploying the Ana Alexa Skill to AWS and the Alexa Developer Console.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Alexa Developer Account**
3. **Node.js 20.x** and **npm** installed
4. **AWS SAM CLI** installed
5. **ASK CLI** (Alexa Skills Kit Command Line Interface) installed
6. **Git** installed

## Deployment Steps

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
# AWS Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-west-2

# Alexa Skill Configuration
SKILL_ID=your-skill-id  # Optional, can be set later

# API Endpoints
HISTORICAL_API_BASE=your-historical-api-endpoint
RESTAURANT_API_BASE=your-restaurant-api-endpoint
RECIPE_API_BASE=your-recipe-api-endpoint

# Feature Flags
USE_BEDROCK_NLQ=false
```

### 4. Build the Project

```bash
npm run build
```

### 5. Deploy to AWS

#### Option A: Using AWS SAM (Recommended for Production)

1. Build the application:
   ```bash
   sam build --use-container
   ```

2. Deploy the application:
   ```bash
   sam deploy --guided
   ```
   
   Follow the interactive prompts. For the first deployment, you'll need to provide:
   - Stack Name: `ana-alexa-skill-stack`
   - AWS Region: `us-west-2`
   - Confirm changes before deploy: `y`
   - Allow SAM CLI IAM role creation: `y`
   - Disable rollback: `n`
   - Save arguments to configuration file: `y`
   - SAM configuration file: `samconfig.toml`
   - SAM configuration environment: `default`

#### Option B: Using the Deployment Script

1. Make the deployment script executable:
   ```bash
   chmod +x scripts/deploy-skill.ts
   ```

2. Run the deployment script:
   ```bash
   npx ts-node scripts/deploy-skill.ts
   ```

### 6. Deploy to Alexa Developer Console

1. Install the ASK CLI if you haven't already:
   ```bash
   npm install -g ask-cli
   ```

2. Configure the ASK CLI:
   ```bash
   ask configure
   ```
   Follow the prompts to log in with your Amazon Developer account.

3. Deploy the skill:
   ```bash
   ask deploy
   ```

### 7. Test the Skill

1. Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Select your skill
3. Go to the "Test" tab
4. Enable testing in the top right corner
5. Use the voice or text input to test your skill

## CI/CD Pipeline

The project includes a GitHub Actions workflow that automates testing and deployment:

1. On every push to `main` branch:
   - Runs tests
   - Builds the application
   - Deploys to AWS (if tests pass)

### Required GitHub Secrets

For the CI/CD pipeline to work, you need to set the following secrets in your GitHub repository:

- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `S3_BUCKET_NAME`: S3 bucket for SAM deployment artifacts
- `HISTORICAL_API_BASE`: Historical dishes API endpoint
- `RESTAURANT_API_BASE`: Restaurant API endpoint
- `RECIPE_API_BASE`: Recipe API endpoint
- `USE_BEDROCK_NLQ`: Set to 'true' to enable Bedrock NLQ (default: 'false')

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**:
   - Ensure your IAM user has the necessary permissions
   - Check that your AWS credentials are correctly configured

2. **Skill Deployment Failures**:
   - Check the CloudFormation stack events in the AWS Console
   - Verify that all required environment variables are set

3. **API Timeouts**:
   - Increase the Lambda function timeout in `template.yaml` if needed
   - Check that your API endpoints are accessible from the Lambda function

4. **Alexa Skill Testing Issues**:
   - Check the CloudWatch logs for your Lambda function
   - Verify that your interaction model is correctly defined

## Rollback Procedure

If you need to rollback to a previous version:

1. Revert your code to the desired commit:
   ```bash
   git checkout <commit-hash>
   ```

2. Redeploy:
   ```bash
   sam build && sam deploy
   ```

## Monitoring and Logging

- **CloudWatch Logs**: View logs for your Lambda function in the AWS CloudWatch console
- **Alexa Developer Console**: Monitor skill usage and errors
- **AWS X-Ray**: Enable X-Ray tracing for detailed request tracing

## Security Considerations

- Never commit sensitive information (API keys, AWS credentials) to version control
- Use AWS Secrets Manager or Parameter Store for sensitive configuration
- Regularly rotate your AWS access keys
- Follow the principle of least privilege for IAM roles and policies
