#!/usr/bin/env node

// Set CDK environment variables before any imports
process.env.CDK_DISABLE_ASSET_STAGING = 'true';
process.env.CDK_DISABLE_VERSION_REPORTING = 'true';
process.env.CDK_DISABLE_ASSET_BUNDLING = 'true';
process.env.CDK_NEW_BOOTSTRAP = '1';
process.env.CDK_DISABLE_STACK_TRACE = 'true';
process.env.CDK_DISABLE_LOGGING = 'true';

import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Initialize app with minimal configuration and all S3 features disabled
const app = new App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': true,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:defaultEncryption': false,
    '@aws-cdk/aws-s3:disableDefaultLogging': true,
    '@aws-cdk/aws-s3:disableAccessLogging': true,
    '@aws-cdk/aws-s3:disableServerAccessLogging': true,
    '@aws-cdk/aws-cloudwatch-logs:disableCloudWatchLogs': true,
    '@aws-cdk/core:target-partitions': ['aws'],
    '@aws-cdk/core:bootstrapQualifier': 'minimal',
    '@aws-cdk/core:disableAssetBucketCreation': true,
    '@aws-cdk/core:suppressAssetBucketCreation': true,
    '@aws-cdk/core:disableVersionCheck': true,
    '@aws-cdk/core:disableCloudFormationLogs': true,
    '@aws-cdk/core:disableStackTraces': true,
    '@aws-cdk/core:disableMetricsCollection': true
  },
  analyticsReporting: false,
  treeMetadata: false
});

new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
