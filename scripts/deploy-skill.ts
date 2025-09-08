#!/usr/bin/env node

/**
 * Script to deploy the Alexa skill to the Alexa Developer Console
 * This script should be run after the AWS deployment is complete
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Configuration
const SKILL_ID = process.env.SKILL_ID || '';
const PROFILE = process.env.AWS_PROFILE || 'default';
const REGION = process.env.AWS_REGION || 'us-west-2';
const SKILL_PACKAGE_DIR = path.join(__dirname, '../../skill-package');
const MODELS_DIR = path.join(__dirname, '../../models');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if ASK CLI is installed
function checkAskCliInstalled(): boolean {
  try {
    execSync('ask --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install ASK CLI if not installed
async function installAskCli(): Promise<boolean> {
  console.log('ASK CLI not found. Installing...');
  try {
    execSync('npm install -g ask-cli', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to install ASK CLI:', error);
    return false;
  }
}

// Initialize ASK CLI
async function initAskCli(): Promise<boolean> {
  try {
    console.log('Initializing ASK CLI...');
    execSync('ask configure', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to initialize ASK CLI:', error);
    return false;
  }
}

// Deploy the skill
async function deploySkill(): Promise<void> {
  try {
    console.log('Deploying skill to Alexa Developer Console...');
    
    // Create skill package directory if it doesn't exist
    if (!fs.existsSync(SKILL_PACKAGE_DIR)) {
      fs.mkdirSync(SKILL_PACKAGE_DIR, { recursive: true });
    }
    
    // Ensure interaction model directory exists
    const interactionModelDir = path.join(SKILL_PACKAGE_DIR, 'interactionModels', 'custom');
    fs.mkdirSync(interactionModelDir, { recursive: true });

    // Copy interaction model
    fs.copyFileSync(
      path.join(MODELS_DIR, 'en-US.json'),
      path.join(interactionModelDir, 'en-US.json')
    );
    
    // Create skill manifest
    const manifest = {
      manifest: {
        publishingInformation: {
          locales: {
            'en-US': {
              name: 'Meal Advisor',
              summary: 'A skill that recommends meals and restaurants',
              description: 'Get personalized meal and restaurant recommendations based on your preferences.',
              examplePhrases: [
                'Alexa, open Meal Advisor',
                'Alexa, ask Meal Advisor to recommend a dish',
                'Alexa, tell Meal Advisor to find me an Italian restaurant'
              ],
              keywords: ['food', 'restaurant', 'meal', 'recipe', 'recommendation']
            }
          },
          isAvailableWorldwide: true,
          testingInstructions: 'Test the skill by asking for meal recommendations or saving preferences.',
          category: 'FOOD_AND_DRINK',
          distributionCountries: []
        },
        apis: {
          custom: {}
        },
        manifestVersion: '1.0',
        permissions: [
          { name: 'alexa::profile:email:read' },
          { name: 'alexa::profile:name:read' },
          { name: 'alexa::devices:all:geolocation:address' }
        ]
      }
    };
    
    // Save manifest (ensure package dir exists and write file)
    fs.mkdirSync(SKILL_PACKAGE_DIR, { recursive: true });
    const manifestPath = path.join(SKILL_PACKAGE_DIR, 'skill.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Wrote manifest to: ${manifestPath}`);
    
    // Deploy the skill
    const deployCmd = `ask deploy --target skill`;
    execSync(deployCmd, { stdio: 'inherit' });
    
    console.log('Skill deployment completed successfully!');
    
  } catch (error) {
    console.error('Error deploying skill:', error);
    process.exit(1);
  }
}

// Main function
async function main() {
  console.log('Starting Alexa skill deployment...');
  
  // Check if ASK CLI is installed
  if (!checkAskCliInstalled()) {
    const install = await new Promise<boolean>((resolve) => {
      rl.question('ASK CLI is not installed. Would you like to install it now? (y/n) ', (answer) => {
        resolve(answer.toLowerCase() === 'y');
      });
    });
    
    if (install) {
      const installed = await installAskCli();
      if (!installed) {
        console.error('Please install ASK CLI manually and try again.');
        process.exit(1);
      }
      
      // Initialize ASK CLI after installation
      await initAskCli();
    } else {
      console.log('Please install ASK CLI manually and try again.');
      process.exit(1);
    }
  }
  
  // Deploy the skill
  await deploySkill();
  
  // Close readline interface
  rl.close();
}

// Run the script
main().catch(console.error);
