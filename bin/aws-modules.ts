#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Configure app with disabled S3 features
const app = new cdk.App({
  context: {
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:defaultEncryption': false,
    '@aws-cdk/aws-s3:disableDefaultLogging': true,
    '@aws-cdk/aws-s3:disableAccessLogging': true,
    '@aws-cdk/aws-s3:disableServerAccessLogging': true,
    '@aws-cdk/core:newStyleStackSynthesis': false,
    '@aws-cdk/aws-cloudwatch-logs:disableCloudWatchLogs': true,
  }
});

// Create the main stack with minimal configuration
new AwsModulesStack(app, 'AwsModulesStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
  terminationProtection: false,
});

app.synth();
