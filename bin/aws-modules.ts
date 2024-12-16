#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack without synthesizer to prevent automatic bucket creation
new AwsModulesStack(app, 'AwsModulesStack', {
  env,
  terminationProtection: false,
});

app.synth();
