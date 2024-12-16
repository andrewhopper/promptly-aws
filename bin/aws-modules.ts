#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Disable all automatic resource creation
process.env.CDK_NEW_BOOTSTRAP = '1';
process.env.CDK_DISABLE_ASSET_STAGING = 'true';
process.env.CDK_DISABLE_VERSION_REPORTING = 'true';
process.env.CDK_DISABLE_ASSET_BUNDLING = 'true';
process.env.CDK_DISABLE_ASSET_STAGING_CUSTOM = 'true';
process.env.CDK_DISABLE_STACK_TRACE = 'true';

// Initialize app with minimal configuration
const app = new App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': false,
    '@aws-cdk/core:bootstrapQualifier': 'minimal',
    '@aws-cdk/core:enableLegacyStackSynthesizer': true,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:defaultEncryption': false,
    '@aws-cdk/aws-s3:disableDefaultLogging': true,
    '@aws-cdk/aws-s3:disableAccessLogging': true,
    '@aws-cdk/aws-s3:disableServerAccessLogging': true,
    '@aws-cdk/aws-cloudwatch-logs:disableCloudWatchLogs': true,
    '@aws-cdk/core:target-partitions': ['aws'],
    '@aws-cdk/core:disableAssetBucketCreation': true,
    '@aws-cdk/core:suppressAssetBucketCreation': true,
    '@aws-cdk/aws-s3:disableDefaultBucketAccessControl': true,
    '@aws-cdk/aws-s3:disableDefaultBucketEncryption': true,
    '@aws-cdk/aws-s3:disableDefaultBucketPolicies': true,
    '@aws-cdk/aws-s3:disableDefaultBucketVersioning': true,
    '@aws-cdk/aws-s3:disableDefaultBucketWebsiteConfiguration': true,
    '@aws-cdk/aws-s3:disableDefaultBucketAnalytics': true,
    '@aws-cdk/aws-s3:disableDefaultBucketInventory': true,
    '@aws-cdk/aws-s3:disableDefaultBucketMetrics': true,
    '@aws-cdk/aws-s3:disableDefaultBucketNotifications': true,
    '@aws-cdk/aws-s3:disableDefaultBucketTagging': true,
    '@aws-cdk/aws-s3:disableDefaultBucketCors': true,
    '@aws-cdk/aws-s3:disableDefaultBucketLifecycle': true,
    '@aws-cdk/aws-s3:disableDefaultBucketReplication': true,
    '@aws-cdk/aws-s3:disableDefaultBucketObjectLock': true,
    '@aws-cdk/aws-s3:disableDefaultBucketRequestPayment': true,
    '@aws-cdk/aws-s3:disableDefaultBucketAccelerateConfiguration': true,
    '@aws-cdk/aws-s3:disableDefaultBucketIntelligentTiering': true
  },
  analyticsReporting: false,
  treeMetadata: false
});

// Create the stack with minimal configuration
new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
