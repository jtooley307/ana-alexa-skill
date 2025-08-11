#!/usr/bin/env node

/**
 * Local testing script for the Ana Alexa Skill
 * This script helps test the skill locally without deploying to AWS
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { handler } from '../src/app';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Sample requests for testing
const SAMPLE_REQUESTS = {
  '1': 'LaunchRequest',
  '2': 'RecommendDishIntent',
  '3': 'RecommendMealIntent',
  '4': 'RecommendRestaurantIntent',
  '5': 'SaveFavoriteDishIntent',
  '6': 'SavePreferredMealTypeIntent',
  '7': 'SaveFavoriteRestaurantIntent',
  '8': 'NaturalLanguageQueryIntent',
  '9': 'HelpIntent',
  '10': 'Exit'
};

// Display menu
function displayMenu() {
  console.log('\n=== Ana Alexa Skill Local Tester ===');
  console.log('1. LaunchRequest');
  console.log('2. RecommendDishIntent');
  console.log('3. RecommendMealIntent');
  console.log('4. RecommendRestaurantIntent');
  console.log('5. SaveFavoriteDishIntent');
  console.log('6. SavePreferredMealTypeIntent');
  console.log('7. SaveFavoriteRestaurantIntent');
  console.log('8. NaturalLanguageQueryIntent');
  console.log('9. HelpIntent');
  console.log('10. Exit');
  console.log('=================================');
}

// Generate a sample request
function generateRequest(requestType: string, userId: string = 'test-user'): any {
  const requestId = `EdwRequestId.${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();
  
  const baseRequest = {
    request: {
      type: '',
      requestId,
      timestamp,
      locale: 'en-US'
    },
    context: {
      System: {
        application: {
          applicationId: 'amzn1.ask.skill.test-app-id'
        },
        user: {
          userId,
          accessToken: 'test-access-token'
        },
        device: {
          deviceId: 'test-device-id',
          supportedInterfaces: {}
        },
        apiEndpoint: 'https://api.amazonalexa.com'
      }
    }
  };

  switch (requestType) {
    case 'LaunchRequest':
      return {
        ...baseRequest,
        request: {
          ...baseRequest.request,
          type: 'LaunchRequest'
        }
      };

    case 'RecommendDishIntent':
      return {
        ...baseRequest,
        request: {
          ...baseRequest.request,
          type: 'IntentRequest',
          intent: {
            name: 'RecommendDishIntent',
            confirmationStatus: 'NONE',
            slots: {
              mealType: {
                name: 'mealType',
                value: 'dinner',
                confirmationStatus: 'NONE'
              },
              cuisine: {
                name: 'cuisine',
                value: 'italian',
                confirmationStatus: 'NONE'
              }
            }
          }
        }
      };

    // Add other intent cases...
    
    case 'NaturalLanguageQueryIntent':
      return {
        ...baseRequest,
        request: {
          ...baseRequest.request,
          type: 'IntentRequest',
          intent: {
            name: 'NaturalLanguageQueryIntent',
            confirmationStatus: 'NONE',
            slots: {
              query: {
                name: 'query',
                value: 'recommend an Italian dish for dinner',
                confirmationStatus: 'NONE'
              }
            }
          }
        }
      };

    case 'HelpIntent':
      return {
        ...baseRequest,
        request: {
          ...baseRequest.request,
          type: 'IntentRequest',
          intent: {
            name: 'AMAZON.HelpIntent',
            confirmationStatus: 'NONE'
          }
        }
      };

    default:
      return baseRequest;
  }
}

// Main function
async function main() {
  console.log('=== Ana Alexa Skill Local Tester ===');
  console.log('This tool helps you test the skill locally.');
  
  let userId = 'test-user';
  
  // Get user ID
  const userIdInput = await new Promise<string>((resolve) => {
    rl.question(`Enter user ID (default: ${userId}): `, (input) => {
      resolve(input || userId);
    });
  });
  
  userId = userIdInput;
  
  // Main loop
  while (true) {
    displayMenu();
    
    const choice = await new Promise<string>((resolve) => {
      rl.question('Select an option (1-10): ', (input) => {
        resolve(input);
      });
    });
    
    if (choice === '10' || choice.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      break;
    }
    
    const requestType = SAMPLE_REQUESTS[choice as keyof typeof SAMPLE_REQUESTS];
    
    if (!requestType) {
      console.log('Invalid option. Please try again.');
      continue;
    }
    
    try {
      console.log(`\n=== Testing ${requestType} ===`);
      const event = generateRequest(requestType, userId);
      
      console.log('Sending request:', JSON.stringify(event, null, 2));
      
      const response = await handler(event, {} as any, () => {});
      
      console.log('\n=== Response ===');
      console.log(JSON.stringify(response, null, 2));
      
      if (response?.response?.outputSpeech?.ssml) {
        console.log('\nSpoken Response:');
        console.log(response.response.outputSpeech.ssml
          .replace(/<[^>]*>/g, '') // Remove SSML tags
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim()
        );
      }
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  rl.close();
}

// Run the script
main().catch(console.error);
