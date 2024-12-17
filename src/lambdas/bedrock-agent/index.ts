import { Handler } from 'aws-lambda';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
  TranscriptResultStream,
  AudioEvent
} from '@aws-sdk/client-transcribe-streaming';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
  SynthesizeSpeechCommandInput
} from '@aws-sdk/client-polly';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

interface VoiceCheckInEvent {
  audioData: string; // Base64 encoded audio data
  userId: string;
  sessionId: string;
}

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const bedrockClient = new BedrockAgentRuntimeClient({});
const transcribeClient = new TranscribeStreamingClient({});
const pollyClient = new PollyClient({});

function createAudioStream(audioData: string): AsyncIterable<AudioStream> {
  const buffer = Buffer.from(audioData, 'base64');
  const chunk_size = 16000; // 1 second of audio at 16kHz
  let offset = 0;

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (offset >= buffer.length) {
            return { done: true, value: undefined };
          }

          const chunk = buffer.slice(offset, offset + chunk_size);
          offset += chunk_size;

          return {
            done: false,
            value: { AudioEvent: { AudioChunk: chunk } }
          };
        }
      };
    }
  };
}

export const handler: Handler<VoiceCheckInEvent> = async (event, context) => {
  console.log('Processing voice check-in:', {
    userId: event.userId,
    sessionId: event.sessionId,
    requestId: context.awsRequestId
  });

  try {
    // 1. Transcribe the audio input using streaming API
    const audioStream = createAudioStream(event.audioData);
    const transcriptionCommand = new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 16000,
      AudioStream: audioStream
    });

    const transcriptionResponse = await transcribeClient.send(transcriptionCommand);
    let transcribedText = '';

    // Process streaming response
    if (transcriptionResponse.TranscriptResultStream) {
      for await (const event of transcriptionResponse.TranscriptResultStream) {
        if (event.TranscriptEvent?.Transcript?.Results?.[0]?.IsPartial === false) {
          const result = event.TranscriptEvent.Transcript.Results[0];
          if (result.Alternatives?.[0]?.Transcript) {
            transcribedText += result.Alternatives[0].Transcript + ' ';
          }
        }
      }
    }

    if (!transcribedText) {
      throw new Error('Failed to transcribe audio input');
    }

    // 2. Invoke Bedrock agent with transcribed text
    const agentResponse = await bedrockClient.send(
      new InvokeAgentCommand({
        agentId: process.env.BEDROCK_AGENT_ID,
        agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
        sessionId: event.sessionId,
        inputText: transcribedText.trim()
      })
    );

    // 3. Process agent response and generate speech
    const responseText = agentResponse.completion || 'Check-in recorded successfully';
    const speechParams: SynthesizeSpeechCommandInput = {
      Engine: Engine.NEURAL,
      OutputFormat: OutputFormat.MP3,
      Text: responseText.toString(),
      VoiceId: VoiceId.Matthew
    };

    const speechResponse = await pollyClient.send(
      new SynthesizeSpeechCommand(speechParams)
    );

    // 4. Record check-in in DynamoDB
    const timestamp = new Date().toISOString();
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE,
        Item: {
          user_id: event.userId,
          last_checkin_at: timestamp,
          message: transcribedText.trim()
        }
      })
    );

    // 5. Return response with synthesized speech
    let audioResponse: string | null = null;
    if (speechResponse.AudioStream instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of speechResponse.AudioStream) {
        chunks.push(Buffer.from(chunk));
      }
      audioResponse = Buffer.concat(chunks).toString('base64');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Check-in processed successfully',
        userId: event.userId,
        timestamp,
        transcribedText: transcribedText.trim(),
        agentResponse: responseText,
        audioResponse
      })
    };
  } catch (error) {
    console.error('Error processing voice check-in:', error);
    throw error;
  }
};
