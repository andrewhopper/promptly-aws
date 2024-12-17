import * as cdk from 'aws-cdk-lib';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface AwsModulesStackProps extends cdk.StackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    // Create content bucket directly using CDK's Bucket construct
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    // Export bucket name
    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      exportName: 'ContentBucketName'
    });
  }
}
