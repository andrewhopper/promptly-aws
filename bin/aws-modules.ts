#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Configure app with minimal settings
const app = new cdk.App();

// Create the main stack with minimal configuration
new AwsModulesStack(app, 'AwsModulesStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
  terminationProtection: false,
});

app.synth();
