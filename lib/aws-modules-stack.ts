import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Email sender Lambda
    const emailSender = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/email-sender/index.ts'),
      handler: 'handler',
      environment: {
        FROM_EMAIL_ADDRESS: 'noreply@yourdomain.com', // Replace with verified SES email
      },
    });

    // Grant SES permissions to email sender Lambda
    emailSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // SMS sender Lambda
    const smsSender = new nodejs.NodejsFunction(this, 'SmsSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/sms-sender/index.ts'),
      handler: 'handler',
    });

    // Grant SNS permissions to SMS sender Lambda
    smsSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'],
    }));
  }
}
