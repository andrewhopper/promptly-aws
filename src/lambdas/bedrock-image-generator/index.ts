import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

interface ImageGenerationEvent {
  prompt: string;
  tone?: 'serious' | 'funny' | 'stern';
  bucketName: string;
  urlExpirationSeconds?: number;
}

interface ContentResponse {
  imageId: string;
  s3Location: string;
  presignedUrl: string;
  smsMessage: string;
  phoneScript: string;
  emailSubject: string;
  emailBody: string;
}

const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

const getTonePromptPrefix = (tone: string = 'serious'): string => {
  switch (tone) {
    case 'funny':
      return 'Create a humorous and light-hearted image with a playful style: ';
    case 'stern':
      return 'Create a serious and authoritative image with a formal style: ';
    case 'serious':
    default:
      return 'Create a professional and balanced image with a neutral style: ';
  }
};

const generateMessageContent = (prompt: string, tone: string = 'serious'): Omit<ContentResponse, 'imageId' | 's3Location' | 'presignedUrl'> => {
  const toneAdjectives = {
    funny: { style: 'humorous', tone: 'light-hearted', ending: '😊' },
    stern: { style: 'formal', tone: 'authoritative', ending: '.' },
    serious: { style: 'professional', tone: 'respectful', ending: '.' }
  };

  const style = toneAdjectives[tone as keyof typeof toneAdjectives] || toneAdjectives.serious;

  return {
    smsMessage: `${prompt} ${style.ending}`,
    phoneScript: `Hello, I'm calling with a ${style.tone} message: ${prompt}`,
    emailSubject: `${style.style.charAt(0).toUpperCase() + style.style.slice(1)} Update: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
    emailBody: `
Dear User,

${prompt}

Best regards,
Your System
`.trim()
  };
};

const generatePresignedUrl = async (bucket: string, key: string, expirationSeconds: number = 3600): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expirationSeconds });
};

export const handler = async (event: ImageGenerationEvent): Promise<{ statusCode: number; body: string }> => {
  try {
    const { prompt, tone = 'serious', bucketName, urlExpirationSeconds = 3600 } = event;
    const imageId = uuidv4();
    const tonePrompt = getTonePromptPrefix(tone) + prompt;

    // Generate image using Bedrock
    const command = new InvokeModelCommand({
      modelId: 'stability.stable-diffusion-xl-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        text_prompts: [{ text: tonePrompt }],
        cfg_scale: 10,
        steps: 50,
      }),
    });

    const response = await bedrockClient.send(command);
    const imageData = JSON.parse(new TextDecoder().decode(response.body)).artifacts[0].base64;
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Upload to S3
    const s3Key = `generated-images/${imageId}.png`;
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/png',
      Metadata: {
        prompt: prompt,
        tone: tone
      }
    }));

    // Generate presigned URL
    const presignedUrl = await generatePresignedUrl(bucketName, s3Key, urlExpirationSeconds);

    // Generate message content
    const messageContent = generateMessageContent(prompt, tone);

    // Update email body to use presigned URL
    const emailBodyWithImage = `
Dear User,

${prompt}

You can view the generated image here: ${presignedUrl}

Best regards,
Your System
`.trim();

    const result: ContentResponse = {
      imageId,
      s3Location: `s3://${bucketName}/${s3Key}`,
      presignedUrl,
      ...messageContent,
      emailBody: emailBodyWithImage
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error generating content:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to generate content',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
