import { Stack, StackProps, App } from 'aws-cdk-lib';
import { LegacyStackSynthesizer } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CustomBucket } from './constructs/custom-bucket';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      env: props?.env,
      synthesizer: new LegacyStackSynthesizer()
    });

    // Create S3 bucket using custom construct
    const contentBucket = new CustomBucket(this, 'ContentBucket');

    // Pass bucket name to Lambda functions that need it
    process.env.CONTENT_BUCKET = contentBucket.bucketName;
  }
}
