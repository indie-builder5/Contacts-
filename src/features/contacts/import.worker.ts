import { parseVcard } from '../../lib/vcard';
import { parseCsv } from '../../lib/csv';
self.onmessage = (event: MessageEvent<{ text: string; extension: string }>) => {
  try {
    self.postMessage({
      result:
        event.data.extension === 'csv' ? parseCsv(event.data.text) : parseVcard(event.data.text),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to read this backup.',
    });
  }
};
