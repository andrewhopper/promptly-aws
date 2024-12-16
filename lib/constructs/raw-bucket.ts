import { Construct } from 'constructs';
import { CfnResource, CfnOutput } from 'aws-cdk-lib';

export interface RawBucketProps {
  bucketName?: string;
}

export class RawBucket extends Construct {
  public readonly bucketName: string;
  public readonly bucketArn: string;

  constructor(scope: Construct, id: string, props?: RawBucketProps) {
    super(scope, id);

    // Create the bucket using raw CloudFormation
    const bucket = new CfnResource(this, 'Resource', {
      type: 'AWS::S3::Bucket',
      properties: {
        AccessControl: 'Private',
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }]
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        },
        OwnershipControls: {
          Rules: [{
            ObjectOwnership: 'BucketOwnerEnforced'
          }]
        },
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }
    });

    this.bucketName = bucket.ref;
    this.bucketArn = bucket.getAtt('Arn').toString();
  }
}
