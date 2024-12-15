import { Context } from 'aws-lambda';

interface TimeCalculatorEvent {
  lastCheckIn: string;
  currentTime: string;
}

export const handler = async (event: TimeCalculatorEvent, context: Context) => {
  const lastCheckInTime = new Date(event.lastCheckIn).getTime();
  const currentTime = new Date(event.currentTime).getTime();

  // Calculate elapsed time in seconds
  const elapsedTime = Math.floor((currentTime - lastCheckInTime) / 1000);

  return elapsedTime;
};
