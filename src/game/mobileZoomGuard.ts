const DOUBLE_TAP_WINDOW_MS = 320;

export interface MobileZoomGuardSnapshot {
  viewportScale: number;
  preventedZoomGestures: number;
  preventedMultiTouchStarts: number;
  preventedMultiTouchMoves: number;
  preventedWheelZooms: number;
  preventedDoubleTaps: number;
  lastPreventedZoomAt: number;
}

export interface MobileZoomGuard {
  dispose: () => void;
  getSnapshot: () => MobileZoomGuardSnapshot;
}

export function createMobileZoomGuard(root: HTMLElement): MobileZoomGuard {
  let preventedZoomGestures = 0;
  let preventedMultiTouchStarts = 0;
  let preventedMultiTouchMoves = 0;
  let preventedWheelZooms = 0;
  let preventedDoubleTaps = 0;
  let lastPreventedZoomAt = 0;
  let lastTouchEndAt: number | null = null;

  const markPrevented = (): void => {
    lastPreventedZoomAt = roundMetric(performance.now());
  };

  const preventBrowserDefault = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }
    markPrevented();
  };

  const onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      return;
    }

    preventedMultiTouchStarts++;
    preventBrowserDefault(event);
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      return;
    }

    preventedMultiTouchMoves++;
    preventBrowserDefault(event);
  };

  const onTouchEnd = (event: TouchEvent): void => {
    const now = performance.now();
    const isDoubleTapWindow = lastTouchEndAt !== null && now - lastTouchEndAt <= DOUBLE_TAP_WINDOW_MS;
    lastTouchEndAt = now;

    if (!isDoubleTapWindow || event.changedTouches.length === 0) {
      return;
    }

    preventedDoubleTaps++;
    preventBrowserDefault(event);
  };

  const onDoubleClick = (event: MouseEvent): void => {
    preventedDoubleTaps++;
    preventBrowserDefault(event);
  };

  const onGesture = (event: Event): void => {
    preventedZoomGestures++;
    preventBrowserDefault(event);
  };

  const onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey) {
      return;
    }

    preventedWheelZooms++;
    preventBrowserDefault(event);
  };

  const nonPassiveCaptureOptions = { capture: true, passive: false } satisfies AddEventListenerOptions;
  const captureOptions = { capture: true } satisfies AddEventListenerOptions;

  document.addEventListener('touchstart', onTouchStart, nonPassiveCaptureOptions);
  document.addEventListener('touchmove', onTouchMove, nonPassiveCaptureOptions);
  document.addEventListener('touchend', onTouchEnd, nonPassiveCaptureOptions);
  root.addEventListener('dblclick', onDoubleClick, nonPassiveCaptureOptions);
  window.addEventListener('wheel', onWheel, nonPassiveCaptureOptions);
  window.addEventListener('gesturestart', onGesture, nonPassiveCaptureOptions);
  window.addEventListener('gesturechange', onGesture, nonPassiveCaptureOptions);
  window.addEventListener('gestureend', onGesture, nonPassiveCaptureOptions);

  return {
    dispose: () => {
      document.removeEventListener('touchmove', onTouchMove, captureOptions);
      document.removeEventListener('touchstart', onTouchStart, captureOptions);
      document.removeEventListener('touchend', onTouchEnd, captureOptions);
      root.removeEventListener('dblclick', onDoubleClick, captureOptions);
      window.removeEventListener('wheel', onWheel, captureOptions);
      window.removeEventListener('gesturestart', onGesture, captureOptions);
      window.removeEventListener('gesturechange', onGesture, captureOptions);
      window.removeEventListener('gestureend', onGesture, captureOptions);
    },
    getSnapshot: () => ({
      viewportScale: readViewportScale(),
      preventedZoomGestures,
      preventedMultiTouchStarts,
      preventedMultiTouchMoves,
      preventedWheelZooms,
      preventedDoubleTaps,
      lastPreventedZoomAt,
    }),
  };
}

function readViewportScale(): number {
  return roundMetric(window.visualViewport?.scale ?? 1);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
