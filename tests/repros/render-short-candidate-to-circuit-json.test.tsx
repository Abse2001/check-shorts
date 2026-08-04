import { expect, test } from "bun:test";
import { appendCopperBridgeTrace, createShortDebugSvg } from "lib/index";
import {
  writeOrCompareBitmapSnapshot,
  writeOrCompareCircuitJsonSvgSnapshot,
  writeOrCompareSvgSnapshot,
} from "tests/fixtures/bitmap-snapshot";
import { getTestFixture } from "tests/fixtures/get-test-fixture";
import { copperBridgeShortRepro } from "tests/fixtures/repros";

test("renders a copper bridge short candidate PCB snapshot", async () => {
  const { circuit } = getTestFixture();
  circuit.add(copperBridgeShortRepro);
  await circuit.renderUntilSettled();

  const bridgedCircuitJson = appendCopperBridgeTrace(circuit.getCircuitJson(), {
    // Cross the existing R1-to-C1 trace at the board center so the bitmap
    // snapshot contains one, unambiguous short beneath its marker.
    start: { x: 0, y: -2.2 },
    end: { x: 0, y: 2.2 },
  });
  const pcbTraces = bridgedCircuitJson.filter(
    (element) => element.type === "pcb_trace",
  );

  expect(
    pcbTraces.some(
      (element) => element.pcb_trace_id === "pcb_trace_short_bridge",
    ),
  ).toBe(true);
  expect(pcbTraces.length).toBeGreaterThanOrEqual(2);
  const pcbShorts = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "pcb-bitmap",
    bridgedCircuitJson,
    { mode: "pcb" },
  );
  const gerberShorts = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "gerber-bitmap",
    bridgedCircuitJson,
    { mode: "gerber" },
  );

  expect(pcbShorts.length).toBe(1);
  expect(gerberShorts.length).toBe(1);
  expect(
    pcbShorts.every((short) =>
      short.secondOwnerLabels.includes("pcb_trace_short_bridge"),
    ),
  ).toBe(true);
  await writeOrCompareSvgSnapshot(
    import.meta.path,
    createShortDebugSvg(bridgedCircuitJson, [...pcbShorts, ...gerberShorts]),
  );
  await writeOrCompareCircuitJsonSvgSnapshot(
    import.meta.path,
    bridgedCircuitJson,
  );
});
