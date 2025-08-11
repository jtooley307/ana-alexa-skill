#!/bin/bash

# Deploy Alexa Skill Lambda Function
# This script packages and deploys the Alexa Skill Lambda function

set -e

echo "🎙️ Starting Alexa Skill Lambda deployment..."

# Configuration
FUNCTION_NAME="AnaAlexaSkill"
LAMBDA_DIR="."
PACKAGE_DIR="lambda-package"
REGION="us-west-2"
OUTPUT_ZIP="alexa-skill-deployment.zip"

# Clean up any previous builds
echo "🧹 Cleaning up previous builds..."
rm -rf $PACKAGE_DIR
rm -f $OUTPUT_ZIP

# Build the TypeScript code
echo "🔨 Building TypeScript code..."
npm run build

# Create package directory
echo "📁 Creating deployment package..."
mkdir -p $PACKAGE_DIR

# Copy necessary files
echo "📄 Copying files to package..."
cp -r dist/ $PACKAGE_DIR/
cp package.json $PACKAGE_DIR/
cp package-lock.json $PACKAGE_DIR/
cp .env $PACKAGE_DIR/ 2>/dev/null || echo "ℹ️ No .env file found, using environment variables"

# Install production dependencies
echo "📚 Installing production dependencies..."
cd $PACKAGE_DIR
npm install --production
rm package.json package-lock.json  # Remove development files

# Create deployment zip
echo "📦 Creating deployment package..."
zip -r ../$OUTPUT_ZIP .
cd ..

# Deploy or update Lambda function
echo "🚀 Deploying Lambda function..."

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION >/dev/null 2>&1; then
    echo "📝 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$OUTPUT_ZIP \
        --region $REGION
else
    echo "🆕 Creating new Lambda function..."
    # Get the execution role ARN
    ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text 2>/dev/null || \
               echo "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/service-role/AnaAlexaSkill-role-9yk3gmqj")
    
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role $ROLE_ARN \
        --handler dist/app.handler \
        --zip-file fileb://$OUTPUT_ZIP \
        --timeout 30 \
        --memory-size 512 \
        --region $REGION \
        --description "Alexa Skill Lambda function for Ana - Food and Restaurant Recommendations" \
        --environment '{
            "Variables": {
                "DYNAMODB_TABLE": "AlexaUserPreferences",
                "HISTORICAL_API_BASE": "https://2kfsa0b68h.execute-api.us-west-2.amazonaws.com/prod/historical-dishes",
                "RESTAURANT_API_BASE": "https://4ccoyys838.execute-api.us-west-2.amazonaws.com/prod/restaurants",
                "RECIPES_API_BASE": "https://h5dyjlxrog.execute-api.us-west-2.amazonaws.com/prod/recipes"
            }
        }'
fi

# Set environment variables (update if they exist)
echo "🔧 Setting environment variables..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --environment '{
        "Variables": {
            "DYNAMODB_TABLE": "AlexaUserPreferences",
            "HISTORICAL_API_BASE": "https://2kfsa0b68h.execute-api.us-west-2.amazonaws.com/prod/historical-dishes",
            "RESTAURANT_API_BASE": "https://4ccoyys838.execute-api.us-west-2.amazonaws.com/prod/restaurants",
            "RECIPES_API_BASE": "https://h5dyjlxrog.execute-api.us-west-2.amazonaws.com/prod/recipes"
        }
    }' \
    --region $REGION

# Clean up
echo "🧹 Cleaning up deployment files..."
rm -rf $PACKAGE_DIR
rm -f $OUTPUT_ZIP

echo "✅ Alexa Skill Lambda deployment completed!"
echo "📍 Function name: $FUNCTION_NAME"
echo "🌐 Region: $REGION"

# Get function info
echo "📊 Function details:"
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.[FunctionName,Runtime,Handler,LastModified,MemorySize,Timeout]' --output table
