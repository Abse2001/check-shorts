import { deflateSync } from "node:zlib";
import { decode } from "fast-png";
import type {
  BitmapShortDebugLegendEntry,
  BitmapShortDebugRender,
} from "./bitmap-short-detector";
import { renderSvgToPng } from "./svg-to-png";

const crcTable = new Uint32Array(256);

for (let i = 0; i < crcTable.length; i++) {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crcTable[i] = crc >>> 0;
}

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUInt32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value);
  return bytes;
};

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
};

const textEncoder = new TextEncoder();

const createChunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = textEncoder.encode(type);
  const crcInput = concatBytes([typeBytes, data]);

  return concatBytes([
    writeUInt32(data.length),
    typeBytes,
    data,
    writeUInt32(crc32(crcInput)),
  ]);
};

export const encodeRgbaPng = ({
  width,
  height,
  rgba,
}: {
  width: number;
  height: number;
  rgba: Uint8Array;
}): Uint8Array => {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;

  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0;
    scanlines.set(
      rgba.subarray(y * width * 4, (y + 1) * width * 4),
      scanlineOffset + 1,
    );
  }

  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk("IHDR", header),
    createChunk("IDAT", deflateSync(scanlines, { level: 1 })),
    createChunk("IEND", new Uint8Array()),
  ]);
};

const getLegendLabel = (entry: BitmapShortDebugLegendEntry): string => {
  const labels =
    entry.labels.length > 0 ? entry.labels.join(",") : entry.connectivityKey;
  return labels.length > 36 ? `${labels.slice(0, 33)}...` : labels;
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const markerLegend = [
  { color: "#ff00ff", label: "Short marker" },
  { color: "#ffa500", label: "PCB port" },
  { color: "#000000", label: "Unassigned" },
] as const;

const createBitmapLegendSvg = ({
  width,
  height,
  legend,
}: {
  width: number;
  height: number;
  legend: BitmapShortDebugLegendEntry[];
}): string => {
  const headerHeight = 26;
  const rowHeight = 20;
  const rows = [
    ...markerLegend.map(
      (entry, index) => `
    <rect x="10" y="${headerHeight + index * rowHeight + 3}" width="14" height="10" rx="1" fill="${entry.color}"/>
    <text x="32" y="${headerHeight + index * rowHeight + 13}" class="legend-label">${entry.label}</text>`,
    ),
    ...legend.map(
      (entry, index) => `
    <rect x="10" y="${headerHeight + (markerLegend.length + index) * rowHeight + 3}" width="14" height="10" rx="1" fill="rgb(${entry.color.join(",")})"/>
    <text x="32" y="${headerHeight + (markerLegend.length + index) * rowHeight + 13}" class="legend-label">${escapeXml(getLegendLabel(entry))}</text>`,
    ),
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #111; text-rendering: geometricPrecision; }
    .legend-title { font-size: 14px; font-weight: 700; }
    .legend-label { font-size: 12px; font-weight: 500; }
  </style>
  <rect width="100%" height="100%" fill="white"/>
  <text x="10" y="18" class="legend-title">Legend</text>${rows}
</svg>`;
};

export const appendBitmapLegend = (
  debugRender: BitmapShortDebugRender,
): BitmapShortDebugRender => {
  const legendHeight =
    34 + (markerLegend.length + debugRender.legend.length) * 20;
  const width = debugRender.width;
  const height = debugRender.height + legendHeight;
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < debugRender.height; y++) {
    rgba.set(
      debugRender.rgba.subarray(
        y * debugRender.width * 4,
        (y + 1) * debugRender.width * 4,
      ),
      y * width * 4,
    );
  }
  const legendPng = decode(
    renderSvgToPng(
      createBitmapLegendSvg({
        width,
        height: legendHeight,
        legend: debugRender.legend,
      }),
      { loadSystemFonts: true },
    ),
  );
  if (
    legendPng.width !== width ||
    legendPng.height !== legendHeight ||
    legendPng.channels !== 4 ||
    legendPng.depth !== 8
  ) {
    throw new Error("Unable to render bitmap debug legend");
  }
  rgba.set(legendPng.data, debugRender.height * width * 4);

  return { ...debugRender, width, height, rgba };
};
