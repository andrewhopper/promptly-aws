import { Stack, App, CfnOutput, StackProps } from 'aws-cdk-lib';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';
import { RawBucket } from './constructs/raw-bucket';

interface AwsModulesStackProps extends StackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

// Base stack class that prevents automatic bucket creation
class NoAssetStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    const stack = this as any;
    stack.templateOptions = {
      ...stack.templateOptions,
      description: 'Stack with no automatic bucket creation',
      transforms: [],
      metadata: {},
      assets: {
        fileAssets: [],
        dockerImages: []
      }
    };
  }

  protected allocateLogicalId(): string {
    return '';
  }
}

// Use NoAssetStack instead of Stack
export class AwsModulesStack extends NoAssetStack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, props);

    const bucket = new RawBucket(this, 'ContentBucket', {
      bucketName: `${Stack.of(this).stackName.toLowerCase()}-content-${Stack.of(this).account}-${Stack.of(this).region}`
    });

    new CfnOutput(this, 'ContentBucketName', {
      value: bucket.bucketName,
      exportName: 'ContentBucketName'
    });
  }
}
