export function isWayland(): boolean {
  return process.platform === 'linux' && !!process.env.WAYLAND_DISPLAY;
}
