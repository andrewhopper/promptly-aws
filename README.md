# AWS Modules Stack

A CDK TypeScript project providing reusable AWS service modules for communication and content generation.

## Stack Components

### Email Service (SES)
- Sends emails using AWS SES
- Required Environment Variables:
  - `FROM_EMAIL`: Verified sender email address

### SMS Service (SNS)
- Sends SMS messages using AWS SNS
- No additional configuration required

### DynamoDB Integration
- Provides read/write operations for DynamoDB
- Separate Lambda functions for read and write operations
- Table ARNs must be specified in stack configuration

### Bedrock Image Generation
- Generates images using Stable Diffusion XL model
- Configuration:
  - Model: stability.stable-diffusion-xl
  - Default Parameters:
    - cfg_scale: 10
    - steps: 50
- Required S3 bucket for image storage
- Images stored privately with secure access

### Chime Voice Integration
- Creates SIP media applications
- Required Environment Variables:
  - `AWS_REGION`: AWS region for Chime services
  - `VOICE_HANDLER_LAMBDA_ARN`: ARN of voice handling Lambda

## Prerequisites

1. AWS Account and Credentials
2. Node.js 18.x
3. AWS CDK CLI (`npm install -g aws-cdk`)
4. Enabled AWS Services:
   - Amazon SES (with verified email)
   - Amazon SNS
   - Amazon DynamoDB
   - Amazon Bedrock
   - Amazon Chime SDK Voice
   - Amazon S3

## Security Configuration

### S3 Storage
- Bucket objects are private by default
- Use presigned URLs for temporary access
- Server access logging enabled via bucket policy
- No public access allowed

### IAM Permissions
Each Lambda function has specific IAM roles with least-privilege permissions:
- Email: SES send permissions
- SMS: SNS publish permissions
- DynamoDB: Table-specific read/write permissions
- Bedrock: Model invocation permissions
- Chime: SIP media application management
- S3: Object management for generated content

## Environment Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
export CDK_DEFAULT_REGION=us-east-1  # Or your preferred region
export FROM_EMAIL=your-verified@email.com
export VOICE_HANDLER_LAMBDA_ARN=arn:aws:lambda:region:account:function:name
```

3. Deploy the stack:
```bash
npx cdk deploy
```

## Development Commands

* `npm run build`   - Compile TypeScript
* `npm run watch`   - Watch for changes
* `npm run test`    - Run tests
* `npx cdk deploy`  - Deploy stack
* `npx cdk diff`    - Compare changes
* `npx cdk synth`   - Generate CloudFormation

## Content Generation

The stack provides unified content generation across multiple channels:
- Image generation via Bedrock
- Voice content via Chime SDK
- Email and SMS messaging
- Supports customization through prompts and parameters

## Monitoring and Logging

- CloudWatch Logs enabled for all Lambda functions
- S3 server access logging enabled
- CloudWatch Metrics available for all services
