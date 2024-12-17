import { Handler } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface ContentPreferences {
  tone: 'serious' | 'funny' | 'stern';
  urgency: 'low' | 'medium' | 'high';
}

interface ContentGeneratorEvent {
  prompt: string;
  preferences: ContentPreferences;
  userId: string;
}

interface GeneratedContent {
  smsMessage: string;
  phoneScript: string;
  emailSubject: string;
  emailBody: string;
  imagePrompt: string;
  imageUrl?: string;
}

const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

const BUCKET_NAME = process.env.CONTENT_BUCKET || '';
const IMAGE_MODEL = 'stability.stable-diffusion-xl-v1';
const TEXT_MODEL = 'anthropic.claude-v2';

export const handler: Handler<ContentGeneratorEvent> = async (event) => {
  try {
    // Generate text content using Claude
    const prompt = [
      'Generate content for a check-in reminder with the following context:',
      `Base prompt: ${event.prompt}`,
      `Tone: ${event.preferences.tone}`,
      `Urgency: ${event.preferences.urgency}`,
      '',
      'Please provide:',
      '1. A concise SMS message (160 characters max)',
      '2. A natural phone call script',
      '3. An email subject line',
      '4. A professional email body',
      '5. An image description for visual content',
      '',
      'Format the response as JSON with these exact keys:',
      '{',
      '  "smsMessage": "...",',
      '  "phoneScript": "...",',
      '  "emailSubject": "...",',
      '  "emailBody": "...",',
      '  "imagePrompt": "..."',
      '}'
    ].join('\n');

    const textResponse = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: TEXT_MODEL,
        body: JSON.stringify({
          prompt,
          max_tokens: 2000,
          temperature: 0.7
        })
      })
    );

    const content: GeneratedContent = JSON.parse(
      JSON.parse(new TextDecoder().decode(textResponse.body)).completion
    );

    // Generate image using Stable Diffusion
    const imageResponse = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: IMAGE_MODEL,
        body: JSON.stringify({
          text_prompts: [{ text: content.imagePrompt }],
          cfg_scale: 10,
          steps: 50,
          seed: Math.floor(Math.random() * 4294967295)
        })
      })
    );

    // Store image in S3 with user-specific path
    const timestamp = new Date().toISOString();
    const imagePath = `${event.userId}/${timestamp}.png`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imagePath,
        Body: Buffer.from(JSON.parse(new TextDecoder().decode(imageResponse.body)).artifacts[0].base64, 'base64'),
        ContentType: 'image/png'
      })
    );

    // Generate presigned URL for the image
    const imageUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imagePath
      }),
      { expiresIn: 3600 } // URL expires in 1 hour
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...content,
        imageUrl
      })
    };
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};
