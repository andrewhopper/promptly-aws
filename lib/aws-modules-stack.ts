import { Stack, App, CfnOutput } from 'aws-cdk-lib';
import { RawBucket } from './constructs/raw-bucket';

interface AwsModulesStackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    // Prevent automatic bucket creation by setting synthesizer to undefined
    super(scope, id, {
      ...props,
      synthesizer: undefined
    });

    // Create S3 bucket using raw CloudFormation construct
    const contentBucket = new RawBucket(this, 'ContentBucket');

    // Export bucket name
    new CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      exportName: 'ContentBucketName'
    });
  }
}
