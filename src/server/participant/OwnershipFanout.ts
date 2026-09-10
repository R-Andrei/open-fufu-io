import type { OwnershipPublication } from "../../participant/OwnershipPlane";

export type OwnershipFanoutSink = Readonly<{
  tryEnqueue(publication: OwnershipPublication): boolean;
  requestResync(): void;
}>;

export type OwnershipFanoutResult = Readonly<{
  delivered: number;
  resyncRequired: number;
}>;

export class OwnershipFanout {
  private readonly sinks = new Map<string, OwnershipFanoutSink>();

  addSink(id: string, sink: OwnershipFanoutSink): void {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError("ownership fanout sink id must be a non-empty string");
    }
    this.sinks.set(id, sink);
  }

  removeSink(id: string): void {
    this.sinks.delete(id);
  }

  publish(publication: OwnershipPublication): OwnershipFanoutResult {
    let delivered = 0;
    let resyncRequired = 0;
    for (const sink of this.sinks.values()) {
      let accepted = false;
      try {
        accepted = sink.tryEnqueue(publication) === true;
      } catch {
        accepted = false;
      }
      if (accepted) {
        delivered += 1;
        continue;
      }
      resyncRequired += 1;
      try {
        sink.requestResync();
      } catch {
        // A broken viewer callback is isolated from publication to other viewers.
      }
    }
    return Object.freeze({ delivered, resyncRequired });
  }
}
