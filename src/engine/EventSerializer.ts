// ================================================================
// Neural Arena — Event Serializer
// ================================================================
// Handles serialization and deserialization of the event stream.
// Supports BigInt serialization seamlessly to preserve high-res
// timing data.
// ================================================================

import * as fs from 'fs';
import { SimulationEventPayload } from './EventBus';

export class EventSerializer {
  /**
   * Custom replacer for JSON.stringify to handle BigInt.
   */
  static replacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return { _type: 'bigint', value: value.toString() };
    }
    return value;
  }

  /**
   * Custom reviver for JSON.parse to restore BigInt.
   */
  static reviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value._type === 'bigint') {
      return BigInt(value.value);
    }
    return value;
  }

  /**
   * Serialize an array of events to a JSON string.
   */
  static serialize(events: SimulationEventPayload[]): string {
    return JSON.stringify(events, EventSerializer.replacer);
  }

  /**
   * Deserialize a JSON string back into an array of events.
   */
  static deserialize(json: string): SimulationEventPayload[] {
    return JSON.parse(json, EventSerializer.reviver);
  }

  /**
   * Serialize events and write them to a file (NDJSON-style or array).
   * For simplicity right now, we just write a full JSON array.
   * In a future phase, we'll stream this to NDJSON.
   */
  static writeToFile(events: SimulationEventPayload[], filePath: string): void {
    const data = EventSerializer.serialize(events);
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  /**
   * Read events from a JSON file.
   */
  static readFromFile(filePath: string): SimulationEventPayload[] {
    const data = fs.readFileSync(filePath, 'utf-8');
    return EventSerializer.deserialize(data);
  }
}
