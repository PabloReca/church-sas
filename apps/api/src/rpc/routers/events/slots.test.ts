import { describe, test, expect } from "bun:test";
import { eventSlotsRouter } from "./slots";

describe("Event Slots Router", () => {
  test("router exports required methods", () => {
    expect(eventSlotsRouter.createSlot).toBeDefined();
    expect(eventSlotsRouter.updateSlot).toBeDefined();
    expect(eventSlotsRouter.deleteSlot).toBeDefined();
    expect(eventSlotsRouter.listSlots).toBeDefined();
  });

  // NOTE: Functional tests for event slots are in events.test.ts
  // as they require the full event context setup
});
