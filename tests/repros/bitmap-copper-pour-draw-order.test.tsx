import { expect, test } from "bun:test";
import { appendCopperBridgeTrace, renderBitmapShortDebug } from "lib/index";
import { getDebugColorForConnectivityKey } from "lib/bitmap-debug-overlay";
import { getBoardBounds, getPixelPointFromReal } from "lib/bitmap-geometry";
import {
  writeOrCompareBitmapDebugSnapshot,
  writeOrCompareBitmapSnapshot,
} from "tests/fixtures/bitmap-snapshot";
import { getTestFixture } from "tests/fixtures/get-test-fixture";

test("renders traces over copper pours in the debug bitmap", async () => {
  const { circuit } = getTestFixture();
  circuit.add(
    <board width="14mm" height="10mm">
      <net name="GND" />
      <copperpour layer="top" connectsTo="net.GND" unbroken />
    </board>,
  );
  await circuit.renderUntilSettled();

  const circuitJson = appendCopperBridgeTrace(circuit.getCircuitJson(), {
    pcbTraceId: "pcb_trace_over_pour",
    width: 0.4,
    start: { x: -4, y: 2 },
    end: { x: -2, y: 2 },
  });
  const debug = await renderBitmapShortDebug(circuitJson, { mode: "pcb" });
  const pcbShorts = await writeOrCompareBitmapDebugSnapshot(
    import.meta.path,
    "pcb-bitmap",
    debug,
  );
  const gerberShorts = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "gerber-bitmap",
    circuitJson,
    { mode: "gerber" },
  );
  const pixel = getPixelPointFromReal({
    x: -3.8,
    y: 2,
    bounds: getBoardBounds(circuitJson),
    width: debug.width,
    height: debug.height,
  });
  const pixelIndex = Math.floor(pixel.y) * debug.width + Math.floor(pixel.x);

  expect([...debug.rgba.slice(pixelIndex * 4, pixelIndex * 4 + 3)]).toEqual(
    getDebugColorForConnectivityKey("pcb_trace_over_pour"),
  );
  expect(pcbShorts).toHaveLength(1);
  expect(gerberShorts).toHaveLength(1);
});
