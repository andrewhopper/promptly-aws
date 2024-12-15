import { Context } from 'aws-lambda';

interface TimeCalculatorEvent {
  lastCheckIn: string;
  currentTime: string;
}

interface TimeCalculatorResponse {
  elapsedTime: number;
  status: 'TIME_FOR_CHECKIN' | 'OK';
  metadata: {
    lastCheckInTime: string;
    currentTime: string;
    thresholdSeconds: number;
    message: string;
  };
}

const CHECKIN_THRESHOLD_SECONDS = 3600; // 1 hour

export const handler = async (event: TimeCalculatorEvent, context: Context): Promise<TimeCalculatorResponse> => {
  console.log('Processing check-in time calculation:', {
    event,
    requestId: context.awsRequestId
  });

  try {
    // Parse and validate timestamps
    const lastCheckInTime = new Date(event.lastCheckIn);
    const currentTime = new Date(event.currentTime);

    if (isNaN(lastCheckInTime.getTime())) {
      throw new Error(`Invalid lastCheckIn timestamp: ${event.lastCheckIn}`);
    }
    if (isNaN(currentTime.getTime())) {
      throw new Error(`Invalid currentTime timestamp: ${event.currentTime}`);
    }

    // Calculate elapsed time in seconds
    const elapsedTime = Math.floor((currentTime.getTime() - lastCheckInTime.getTime()) / 1000);

    // Determine check-in status and message
    const status = elapsedTime > CHECKIN_THRESHOLD_SECONDS ? 'TIME_FOR_CHECKIN' : 'OK';
    const message = status === 'TIME_FOR_CHECKIN'
      ? `Time for check-in! It's been ${Math.floor(elapsedTime / 60)} minutes since your last check-in.`
      : 'Check-in status OK';

    const response: TimeCalculatorResponse = {
      elapsedTime,
      status,
      metadata: {
        lastCheckInTime: lastCheckInTime.toISOString(),
        currentTime: currentTime.toISOString(),
        thresholdSeconds: CHECKIN_THRESHOLD_SECONDS,
        message
      }
    };

    console.log('Check-in time calculation complete:', response);
    return response;
  } catch (error) {
    console.error('Error calculating check-in time:', error);
    throw error;
  }
};
