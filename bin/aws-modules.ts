#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
import { AmplifyStack } from '../lib/amplify-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack
const mainStack = new AwsModulesStack(app, 'AwsModulesStack', { env });

// Create the Amplify stack for frontend hosting
const amplifyStack = new AmplifyStack(app, 'aws-modules-amplify', { env });

app.synth();
