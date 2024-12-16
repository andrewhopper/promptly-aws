import { Stack, StackProps, App, RemovalPolicy } from 'aws-cdk-lib';
import { LegacyStackSynthesizer } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      env: props?.env,
      synthesizer: new LegacyStackSynthesizer()
    });

    // Create S3 bucket with explicit configurations to prevent logging issues
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      serverAccessLogsPrefix: undefined,
      serverAccessLogsBucket: undefined,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
    });

    // Pass bucket name to Lambda functions that need it
    process.env.CONTENT_BUCKET = contentBucket.bucketName;
  }
}
