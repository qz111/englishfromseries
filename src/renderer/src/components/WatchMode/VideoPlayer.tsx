// src/renderer/src/components/WatchMode/VideoPlayer.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface VideoPlayerHandle {
  currentTime: () => number;
  togglePlay: () => void;
}

interface Props {
  videoPath: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(({ videoPath }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    currentTime: () => videoRef.current?.currentTime ?? 0,
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {}); else v.pause();
    },
  }));

  return (
    <video
      ref={videoRef}
      src={`file://${videoPath}`}
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      controls
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';
