import { Stack, StackProps, App } from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);
    // Disable access logging for this stack
    this.node.setContext('@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy', false);
    this.node.setContext('@aws-cdk/aws-s3:disableDefaultLogging', true);
  }
}
