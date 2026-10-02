/**
 * Native Speech Recognition Wrapper with Web Fallback (architecture invariant 12).
 * Fails gracefully to typed text if mic or speech service is unavailable.
 */

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export function startSpeechRecognition(
  onResult: (text: string) => void,
  onError: (err: any) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError(new Error('Speech recognition not supported in this browser.'));
    return () => {};
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      onError(event.error);
    };

    recognition.start();

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop error
      }
    };
  } catch (e) {
    onError(e);
    return () => {};
  }
}
