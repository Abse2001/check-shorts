import type { AnyCircuitElement, PcbBoard } from "circuit-json";

type DiagnosticCircuitElement = Extract<
  AnyCircuitElement,
  { type: `${string}_warning` | `${string}_error` }
>;

export type NonDiagnosticCircuitElement = Exclude<
  AnyCircuitElement,
  DiagnosticCircuitElement
>;

export const isNonDiagnosticCircuitElement = (
  element: AnyCircuitElement,
): element is NonDiagnosticCircuitElement =>
  !element.type.endsWith("_warning") && !element.type.endsWith("_error");

export const getNonDiagnosticCircuitJson = (
  circuitJson: AnyCircuitElement[],
): NonDiagnosticCircuitElement[] =>
  circuitJson.filter(isNonDiagnosticCircuitElement);

export const isPcbBoard = (element: AnyCircuitElement): element is PcbBoard =>
  element.type === "pcb_board";
