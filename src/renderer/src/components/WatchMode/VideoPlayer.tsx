// src/renderer/src/components/WatchMode/VideoPlayer.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface VideoPlayerHandle {
  currentTime: () => number;
  togglePlay: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

interface Props {
  videoPath: string;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ videoPath, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const src = `file:///${videoPath.replace(/\\/g, '/')}`;

    useImperativeHandle(ref, () => ({
      currentTime: () => videoRef.current?.currentTime ?? 0,
      togglePlay: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {}); else v.pause();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seek: (time: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
      },
    }));

    return (
      <video
        ref={videoRef}
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        controls
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        onError={(e) => {
          const v = e.currentTarget;
          console.error('Video error:', v.error?.code, v.error?.message, v.src);
        }}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
