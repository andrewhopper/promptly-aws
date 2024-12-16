import { Stack, StackProps, App } from 'aws-cdk-lib';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);
    // Empty stack for testing synthesis - no resources defined
  }
}
