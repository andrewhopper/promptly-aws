import * as cdk from 'aws-cdk-lib';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AmplifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a secret for Bedrock agent configuration
    const bedrockConfig = new secretsmanager.Secret(this, 'BedrockConfig', {
      secretName: 'bedrock-agent-config',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          agentId: '',
          agentAliasId: '',
          region: process.env.AWS_REGION || 'us-east-1',
        }),
        generateStringKey: 'secret',
      },
    });

    // Create IAM role for Amplify app
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Role for Amplify app to access AWS services',
    });

    // Add permissions for Bedrock
    amplifyRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
      ],
      resources: ['*'], // Scope this down to specific agent ARN in production
    }));

    // Add permissions for Secrets Manager
    amplifyRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [bedrockConfig.secretArn],
    }));

    // Create the Amplify app
    const amplifyApp = new amplify.App(this, 'ChatApp', {
      appName: 'aws-modules-chat',
      role: amplifyRole,
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'andrewhopper',
        repository: 'aws-modules',
        oauthToken: cdk.SecretValue.secretsManager('github-token'),
      }),
      environmentVariables: {
        NEXT_PUBLIC_API_ENDPOINT: '/api',
        NEXT_PUBLIC_AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      },
      buildSpec: cdk.aws_codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        frontend: {
          phases: {
            preBuild: {
              commands: [
                'cd frontend',
                'npm ci',
              ],
            },
            build: {
              commands: [
                'npm run build',
              ],
            },
          },
          artifacts: {
            baseDirectory: 'frontend/.next',
            files: ['**/*'],
          },
          cache: {
            paths: ['frontend/node_modules/**/*'],
          },
        },
      }),
    });

    // Add branch
    const main = amplifyApp.addBranch('main', {
      stage: 'PRODUCTION',
      autoBuild: true,
    });

    // Output the Amplify app URL
    new cdk.CfnOutput(this, 'AmplifyAppURL', {
      value: `https://${main.branchName}.${amplifyApp.defaultDomain}`,
      description: 'URL of the Amplify app',
    });
  }
}
