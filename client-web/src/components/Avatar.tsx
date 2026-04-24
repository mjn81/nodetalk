import { useMemo, memo, useState, useEffect } from 'react';
import { minidenticon } from 'minidenticons';
import { Avatar as RadixAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiGetFile } from '@/api/client';

interface AvatarProps {
  userId: string;
  avatarId?: string;
  size?: number;
  className?: string;
}

export const Avatar = memo(({ userId, avatarId, size = 36, className }: AvatarProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const dataUrl = useMemo(() => {
    const svgString = minidenticon(userId, 80, 50);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }, [userId]);

  // Since we are now using a pure Bearer token approach without cookies, 
  // we must ALWAYS fetch images via apiGetFile (which adds the Authorization header)
  // and convert them to blob URLs, because standard <img> tags cannot send headers.
  useEffect(() => {
    if (!avatarId) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    const loadAvatar = async () => {
      try {
        const buffer = await apiGetFile(avatarId, undefined);
        if (!active) return;
        
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.error('Failed to load avatar:', err);
      }
    };

    loadAvatar();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [avatarId]);

  const displayUrl = blobUrl;

  return (
    <RadixAvatar 
      className={`rounded-full overflow-hidden ${className || ''}`} 
      style={{ width: size, height: size }}
    >
      {displayUrl && (
        <AvatarImage 
          src={displayUrl} 
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-transparent border-none">
        <img
          src={dataUrl}
          alt={`Avatar for ${userId}`}
          width={size}
          height={size}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      </AvatarFallback>
    </RadixAvatar>
  );
});

Avatar.displayName = 'Avatar';
