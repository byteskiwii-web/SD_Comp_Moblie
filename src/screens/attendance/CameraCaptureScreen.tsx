import React from 'react';
import { hasVisionCamera } from '../../native/runtime';
import { FallbackCameraCaptureScreen } from './CameraCaptureScreen.fallback';
import type { CameraCaptureProps } from './cameraCaptureTypes';

// Picks a capture screen for whatever runtime we booted into, so ClockPanel
// can keep importing one name.
//
// The require() below is load-bearing and must NOT become a static import.
// `import ... from './CameraCaptureScreen.vision'` is hoisted and evaluated
// when *this* module is evaluated, which pulls in VisionCamera and the Nitro
// face detector -- neither of which exists in the Expo Go binary. That throws
// during bundle evaluation, before any component renders, so no runtime check
// placed inside a component can ever save us. Metro still bundles the vision
// screen either way (it statically sees the require), but a module factory
// only *runs* on first require, which on Expo Go is never.
let visionScreen: React.ComponentType<CameraCaptureProps> | null = null;

function loadVisionScreen(): React.ComponentType<CameraCaptureProps> {
  // Module-level cache: require() is cheap after the first call, but memoising
  // keeps the component identity stable so React never remounts the camera
  // (and re-triggers the permission prompt) on a parent re-render.
  if (!visionScreen) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    visionScreen = require('./CameraCaptureScreen.vision')
      .VisionCameraCaptureScreen as React.ComponentType<CameraCaptureProps>;
  }
  return visionScreen;
}

export function CameraCaptureScreen(props: CameraCaptureProps) {
  if (!hasVisionCamera) return <FallbackCameraCaptureScreen {...props} />;
  const VisionCameraCaptureScreen = loadVisionScreen();
  return <VisionCameraCaptureScreen {...props} />;
}
