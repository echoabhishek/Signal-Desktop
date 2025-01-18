
import * as log from '../logging/log';

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000; // 1 second

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let retries = 0;
  let delay = INITIAL_DELAY;

  while (retries < MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      retries++;
      if (retries >= MAX_RETRIES) {
        log.error(`${operationName} failed after ${MAX_RETRIES} retries:`, error);
        throw error;
      }

      log.warn(`${operationName} failed, retrying (${retries}/${MAX_RETRIES}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw new Error(`${operationName} failed after ${MAX_RETRIES} retries`);
}
