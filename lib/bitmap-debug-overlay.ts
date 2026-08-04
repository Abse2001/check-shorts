import type { Bounds } from "@tscircuit/math-utils";
import type { AnyCircuitElement, PcbPort } from "circuit-json";
import type {
  BitmapShort,
  BitmapShortDebugLegendEntry,
} from "./bitmap-short-types";
import type { CopperElement } from "./bitmap-copper-groups";
import { getPixelPointFromReal } from "./bitmap-geometry";
import { getUniqueOwnerLabels } from "./bitmap-copper-groups";
import type { cju } from "@tscircuit/circuit-json-util";

export const getDebugColorForConnectivityKey = (
  key: string,
): [number, number, number] => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return [
    80 + (hash % 160),
    80 + ((hash >>> 8) % 160),
    80 + ((hash >>> 16) % 160),
  ];
};

export const setRgbaPixel = (
  rgba: Uint8Array,
  index: number,
  color: [number, number, number],
): void => {
  const offset = index * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = 255;
};

const blendRgbaPixel = (
  rgba: Uint8Array,
  index: number,
  color: [number, number, number],
  alpha: number,
): void => {
  const offset = index * 4;
  const inverseAlpha = 1 - alpha;
  rgba[offset] = Math.round(rgba[offset]! * inverseAlpha + color[0] * alpha);
  rgba[offset + 1] = Math.round(
    rgba[offset + 1]! * inverseAlpha + color[1] * alpha,
  );
  rgba[offset + 2] = Math.round(
    rgba[offset + 2]! * inverseAlpha + color[2] * alpha,
  );
  rgba[offset + 3] = 255;
};

export const buildBitmapLegend = ({
  sortedConnectivityGroups,
  db,
}: {
  sortedConnectivityGroups: Array<[string, CopperElement[]]>;
  db: ReturnType<typeof cju>;
}): BitmapShortDebugLegendEntry[] =>
  sortedConnectivityGroups.map(
    ([connectivityKey, elements]): BitmapShortDebugLegendEntry => ({
      connectivityKey,
      color: getDebugColorForConnectivityKey(connectivityKey),
      labels: getUniqueOwnerLabels(elements, db),
    }),
  );

const drawDebugCircleOutline = ({
  rgba,
  width,
  height,
  center,
  radius,
  color,
  alpha = 1,
  strokeWidth = 2.4,
}: {
  rgba: Uint8Array;
  width: number;
  height: number;
  center: { x: number; y: number };
  radius: number;
  color: [number, number, number];
  alpha?: number;
  strokeWidth?: number;
}): void => {
  const strokeRadius = strokeWidth / 2;
  const minX = Math.max(0, Math.floor(center.x - radius - strokeRadius));
  const maxX = Math.min(width - 1, Math.ceil(center.x + radius + strokeRadius));
  const minY = Math.max(0, Math.floor(center.y - radius - strokeRadius));
  const maxY = Math.min(
    height - 1,
    Math.ceil(center.y + radius + strokeRadius),
  );

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);
      if (Math.abs(distance - radius) <= strokeRadius) {
        blendRgbaPixel(rgba, y * width + x, color, alpha);
      }
    }
  }
};

export const overlayPcbPortMarkers = ({
  circuitJson,
  bounds,
  width,
  height,
  rgba,
}: {
  circuitJson: AnyCircuitElement[];
  bounds: Bounds;
  width: number;
  height: number;
  rgba: Uint8Array;
}): void => {
  for (const element of circuitJson) {
    if (element.type !== "pcb_port") continue;
    const port = element as PcbPort;
    const point = getPixelPointFromReal({
      x: port.x,
      y: port.y,
      bounds,
      width,
      height,
    });

    drawDebugCircleOutline({
      rgba,
      width,
      height,
      center: point,
      radius: 5,
      color: [255, 165, 0],
    });
  }
};

export const overlayShortMarkers = ({
  shorts,
  bounds,
  width,
  height,
  rgba,
}: {
  shorts: BitmapShort[];
  bounds: Bounds;
  width: number;
  height: number;
  rgba: Uint8Array;
}): void => {
  // Magenta is outside the generated copper palette (whose RGB components are
  // all at least 80) and is not used by the orange PCB-port marker.
  const markerColor: [number, number, number] = [255, 0, 255];

  for (const short of shorts) {
    const point = getPixelPointFromReal({
      x: short.center.x,
      y: short.center.y,
      bounds,
      width,
      height,
    });

    drawDebugCircleOutline({
      rgba,
      width,
      height,
      center: point,
      radius: 14,
      color: markerColor,
      alpha: 1,
      strokeWidth: 4,
    });
    drawDebugCircleOutline({
      rgba,
      width,
      height,
      center: point,
      radius: 6,
      color: markerColor,
      alpha: 1,
      strokeWidth: 3,
    });
  }
};
