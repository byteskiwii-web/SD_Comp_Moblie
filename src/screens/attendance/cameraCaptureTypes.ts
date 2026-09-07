// Shared by every CameraCaptureScreen variant so ClockPanel can be handed
// whichever one the current runtime supports without knowing which it got.
// Lives in its own file, importing nothing, so the fallback and the dispatcher
// can reference the contract without dragging VisionCamera into their module
// graph.
export type CameraCaptureProps = {
  onCaptured: (filePath: string) => void;
  onCancel: () => void;
};
