import { Construct } from 'constructs';
import { RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class CustomBucket extends Construct {
  public readonly bucketName: string;
  public readonly bucket: s3.CfnBucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the bucket using low-level constructs to avoid automatic logging configuration
    this.bucket = new s3.CfnBucket(this, 'Resource', {
      versioningConfiguration: {
        status: 'Enabled'
      },
      bucketEncryption: {
        serverSideEncryptionConfiguration: [{
          serverSideEncryptionByDefault: {
            sseAlgorithm: 'AES256'
          }
        }]
      },
      publicAccessBlockConfiguration: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      },
      ownershipControls: {
        rules: [{
          objectOwnership: 'BucketOwnerEnforced'
        }]
      }
    });

    // Apply removal policy
    this.bucket.applyRemovalPolicy(RemovalPolicy.RETAIN);

    // Store the bucket name
    this.bucketName = this.bucket.ref;

    // Output the bucket name for reference
    new CfnOutput(this, 'BucketName', {
      value: this.bucketName,
      description: 'The name of the S3 bucket'
    });
  }
}
