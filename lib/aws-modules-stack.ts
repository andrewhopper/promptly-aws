import * as cdk from 'aws-cdk-lib';

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: props?.env,
    });
    // Empty stack for testing synthesis
  }
}
