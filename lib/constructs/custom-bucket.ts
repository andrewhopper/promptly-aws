import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class CustomBucket extends s3.Bucket {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      serverAccessLogsPrefix: undefined,
      serverAccessLogsBucket: undefined,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      publicReadAccess: false
    });

    // Override the allowLogDelivery method to prevent ACL changes
    const cfnBucket = this.node.defaultChild as s3.CfnBucket;
    cfnBucket.addPropertyOverride('AccessControl', 'Private');
    cfnBucket.addPropertyOverride('PublicAccessBlockConfiguration', {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    });
  }
}
