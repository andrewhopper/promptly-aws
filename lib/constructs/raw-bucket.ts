import { Construct } from 'constructs';
import { CfnResource, Fn, Stack } from 'aws-cdk-lib';

export interface RawBucketProps {
  bucketName?: string;
}

export class RawBucket extends Construct {
  public readonly bucketName: string;
  public readonly bucketArn: string;

  constructor(scope: Construct, id: string, props?: RawBucketProps) {
    super(scope, id);

    // Create raw CloudFormation template
    const cfnBucket = new CfnResource(this, 'Resource', {
      type: 'AWS::S3::Bucket',
      properties: {
        BucketName: props?.bucketName || Fn.join('-', [
          Stack.of(this).stackName.toLowerCase(),
          id.toLowerCase(),
          Fn.select(2, Fn.split('/', Stack.of(this).stackId))
        ]),
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
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }]
        },
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }
    });

    this.bucketName = cfnBucket.ref;
    this.bucketArn = Fn.getAtt(cfnBucket.logicalId, 'Arn').toString();
  }
}
