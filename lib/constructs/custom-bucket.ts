import { Construct } from 'constructs';
import { RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';

export class CustomBucket extends Construct {
  public readonly bucketName: string;
  private readonly _bucket: CfnBucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the bucket using low-level constructs to avoid automatic logging configuration
    this._bucket = new CfnBucket(this, 'Resource', {
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
      },
      // Explicitly disable logging to prevent automatic bucket creation
      loggingConfiguration: {
        destinationBucketName: '',
        logFilePrefix: ''
      }
    });

    // Apply removal policy
    this._bucket.applyRemovalPolicy(RemovalPolicy.RETAIN);

    // Store the bucket name
    this.bucketName = this._bucket.ref;

    // Output the bucket name for reference
    new CfnOutput(this, 'BucketName', {
      value: this.bucketName,
      description: 'The name of the S3 bucket'
    });
  }

  // Getter for the bucket reference
  public get cfnBucket(): CfnBucket {
    return this._bucket;
  }
}
