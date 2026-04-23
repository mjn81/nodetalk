import { useMemo, memo } from 'react';
import { minidenticon } from 'minidenticons';
import { Avatar as RadixAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiGetFileUrl } from '@/api/client';

interface AvatarProps {
  userId: string;
  avatarId?: string;
  size?: number;
  className?: string;
}

export const Avatar = memo(({ userId, avatarId, size = 36, className }: AvatarProps) => {
  const dataUrl = useMemo(() => {
    const svgString = minidenticon(userId, 80, 50);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }, [userId]);

  return (
    <RadixAvatar 
      className={`rounded-full overflow-hidden ${className || ''}`} 
      style={{ width: size, height: size }}
    >
      {avatarId && (
        <AvatarImage 
          src={apiGetFileUrl(avatarId)} 
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
