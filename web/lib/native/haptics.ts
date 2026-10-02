/**
 * Native Haptics Wrapper with Web Fallback (architecture invariant 12).
 * Only imported in web/lib/native/ — never ad hoc in components.
 */

export async function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light'): Promise<void> {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      if (type === 'light') {
        navigator.vibrate(10);
      } else if (type === 'medium') {
        navigator.vibrate(25);
      } else if (type === 'success') {
        navigator.vibrate([15, 50, 15]);
      } else if (type === 'warning') {
        navigator.vibrate([30, 80, 30]);
      }
    } catch {
      // Ignore vibration errors on unsupported devices
    }
  }
}
