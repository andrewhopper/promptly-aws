import { Stack, App, CfnOutput, DefaultStackSynthesizer } from 'aws-cdk-lib';
import { RawBucket } from './constructs/raw-bucket';

interface AwsModulesStackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new DefaultStackSynthesizer({
        generateBootstrapVersionRule: false,
        fileAssetsBucketName: 'NONE',
        bucketPrefix: '',
        qualifier: 'minimal'
      })
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
