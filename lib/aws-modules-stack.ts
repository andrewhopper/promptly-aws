import { Stack, StackProps, App } from 'aws-cdk-lib';
import { LegacyStackSynthesizer } from 'aws-cdk-lib';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      env: props?.env,
      synthesizer: new LegacyStackSynthesizer()
    });
  }
}
