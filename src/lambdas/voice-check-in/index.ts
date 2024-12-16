import { Handler } from 'aws-lambda';
import {
  ChimeSDKVoiceClient,
  CreateSipMediaApplicationCallCommand,
  UpdateSipMediaApplicationCallCommand,
  SipMediaApplicationCall
} from '@aws-sdk/client-chime-sdk-voice';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
  TranscriptResultStream,
  AudioEvent
} from '@aws-sdk/client-transcribe-streaming';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
  TextType,
  SynthesizeSpeechCommandInput
} from '@aws-sdk/client-polly';
import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandInput
} from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

interface VoiceCallEvent {
  callId: string;
  fromNumber: string;
  toNumber: string;
  action: 'start' | 'stream' | 'end';
  audioData?: string; // Base64 encoded audio for stream action
  preferences?: {
    tone: 'serious' | 'funny' | 'stern';
  };
}

const chimeClient = new ChimeSDKVoiceClient({});
const transcribeClient = new TranscribeStreamingClient({});
const bedrockClient = new BedrockAgentRuntimeClient({});
const pollyClient = new PollyClient({});
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

// Helper function to create AudioStream from buffer
async function* createAudioStream(buffer: Buffer): AsyncGenerator<{ AudioEvent: { AudioChunk: Buffer } }> {
  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    }
  });

  for await (const chunk of readable) {
    yield {
      AudioEvent: {
        AudioChunk: chunk instanceof Buffer ? chunk : Buffer.from(chunk)
      }
    };
  }
}

export const handler: Handler<VoiceCallEvent> = async (event) => {
  try {
    switch (event.action) {
      case 'start': {
        // Initialize voice call session
        const callResponse = await chimeClient.send(
          new CreateSipMediaApplicationCallCommand({
            FromPhoneNumber: event.fromNumber,
            ToPhoneNumber: event.toNumber,
            SipMediaApplicationId: process.env.SIP_MEDIA_APP_ID
          })
        );

        // Start the call with correct Arguments type
        if (callResponse.SipMediaApplicationCall?.TransactionId) {
          const updateCommand = new UpdateSipMediaApplicationCallCommand({
            SipMediaApplicationId: process.env.SIP_MEDIA_APP_ID!,
            TransactionId: callResponse.SipMediaApplicationCall.TransactionId,
            Arguments: {
              Action: 'START_CHECK_IN',
              CallId: event.callId
            }
          });

          await chimeClient.send(updateCommand);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Voice call initiated',
            transactionId: callResponse.SipMediaApplicationCall?.TransactionId
          })
        };
      }

      case 'stream': {
        if (!event.audioData) {
          throw new Error('Audio data required for stream action');
        }

        // Create audio stream from base64 data
        const buffer = Buffer.from(event.audioData, 'base64');
        const audioStream = createAudioStream(buffer);

        // Transcribe incoming audio
        const transcriptionResponse = await transcribeClient.send(
          new StartStreamTranscriptionCommand({
            LanguageCode: 'en-US',
            MediaEncoding: 'pcm',
            MediaSampleRateHertz: 8000,
            AudioStream: audioStream
          })
        );

        let transcribedText = '';
        if (transcriptionResponse.TranscriptResultStream) {
          for await (const chunk of transcriptionResponse.TranscriptResultStream as AsyncIterable<TranscriptResultStream>) {
            if (chunk.TranscriptEvent?.Transcript?.Results?.[0]?.IsPartial === false) {
              const result = chunk.TranscriptEvent.Transcript.Results[0];
              if (result.Alternatives?.[0]?.Transcript) {
                transcribedText += result.Alternatives[0].Transcript + ' ';
              }
            }
          }
        }

        // Process transcribed text with Bedrock agent
        const agentResponse = await bedrockClient.send(
          new InvokeAgentCommand({
            agentId: process.env.BEDROCK_AGENT_ID,
            agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
            sessionId: event.callId,
            inputText: transcribedText.trim()
          })
        );

        // Generate multi-channel content if preferences are provided
        let contentResponse;
        if (event.preferences) {
          const invokeInput: InvokeCommandInput = {
            FunctionName: process.env.CONTENT_GENERATOR_FUNCTION_NAME,
            Payload: Buffer.from(JSON.stringify({
              prompt: transcribedText.trim(),
              preferences: event.preferences
            }))
          };

          const contentResult = await lambdaClient.send(
            new InvokeCommand(invokeInput)
          );

          if (contentResult.Payload) {
            contentResponse = JSON.parse(Buffer.from(contentResult.Payload).toString());
          }
        }

        // Handle agent response type safely
        const responseText = contentResponse?.phoneCallScript ||
          (typeof agentResponse.completion === 'string' ? agentResponse.completion : 'Thank you for your check-in.');

        // Convert agent response to speech with safe type
        const speechInput: SynthesizeSpeechCommandInput = {
          Engine: Engine.NEURAL,
          OutputFormat: OutputFormat.PCM,
          Text: responseText,
          VoiceId: VoiceId.Matthew,
          TextType: TextType.TEXT,
          SampleRate: '8000'
        };

        const speechResponse = await pollyClient.send(
          new SynthesizeSpeechCommand(speechInput)
        );

        // Store check-in in DynamoDB
        if (responseText) {
          await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.DYNAMODB_TABLE,
              Item: {
                user_id: event.fromNumber,
                last_checkin_at: new Date().toISOString(),
                message: transcribedText.trim(),
                response: responseText,
                content: contentResponse
              }
            })
          );
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Audio processed',
            transcription: transcribedText.trim(),
            response: responseText,
            content: contentResponse,
            audioResponse: speechResponse.AudioStream
          })
        };
      }

      case 'end': {
        // Clean up call resources and save final state
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Call ended',
            callId: event.callId
          })
        };
      }

      default: {
        const errorMessage = `Unsupported action: ${event.action}`;
        console.error(errorMessage);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: errorMessage })
        };
      }
    }
  } catch (error) {
    console.error('Error processing voice call:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
