
import * as log from '../logging/log';

export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://signal.org/ping', { method: 'HEAD' });
    const isConnected = response.ok;
    log.info(`Network connectivity check: ${isConnected ? 'Connected' : 'Disconnected'}`);
    return isConnected;
  } catch (error) {
    log.warn('Network connectivity check failed:', error);
    return false;
  }
}
