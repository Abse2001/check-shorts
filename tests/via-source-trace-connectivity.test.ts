import { expect, test } from "bun:test";
import type { AnyCircuitElement } from "circuit-json";
import { findBitmapShorts } from "../lib";

test("does not report a via connected by source_trace_id as a short", async () => {
  const circuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
    },
    {
      type: "source_net",
      source_net_id: "source_net_gnd",
      name: "GND",
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_gnd",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_gnd"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_gnd",
      source_trace_id: "source_trace_gnd",
      route: [
        {
          route_type: "wire",
          x: -2,
          y: 0,
          width: 0.3,
          layer: "top",
        },
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.3,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_gnd",
      source_trace_id: "source_trace_gnd",
      x: 0,
      y: 0,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
      from_layer: "top",
      to_layer: "bottom",
    },
  ] as AnyCircuitElement[];

  expect(
    await findBitmapShorts(circuitJson, {
      mode: "pcb",
      layer: "top",
      width: 200,
      height: 200,
    }),
  ).toEqual([]);
});

test("does not report a via connected directly by source_net_id as a short", async () => {
  const circuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
    },
    {
      type: "source_net",
      source_net_id: "source_net_gnd",
      name: "GND",
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_gnd",
      connected_source_port_ids: [],
      connected_source_net_ids: ["source_net_gnd"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_gnd",
      source_trace_id: "source_trace_gnd",
      route: [
        {
          route_type: "wire",
          x: -2,
          y: 0,
          width: 0.3,
          layer: "top",
        },
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.3,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_gnd",
      source_net_id: "source_net_gnd",
      x: 0,
      y: 0,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
      from_layer: "top",
      to_layer: "bottom",
    },
  ] as AnyCircuitElement[];

  expect(
    await findBitmapShorts(circuitJson, {
      mode: "pcb",
      layer: "top",
      width: 200,
      height: 200,
    }),
  ).toEqual([]);
});
