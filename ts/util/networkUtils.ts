
export function isOnline(): boolean {
  return navigator.onLine;
}

export function waitForOnline(): Promise<void> {
  return new Promise(resolve => {
    if (isOnline()) {
      resolve();
    } else {
      const onOnline = () => {
        window.removeEventListener('online', onOnline);
        resolve();
      };
      window.addEventListener('online', onOnline);
    }
  });
}
