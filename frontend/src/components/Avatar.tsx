import { minidenticon } from 'minidenticons';
import { Avatar as RadixAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiGetFileUrl } from '@/api/client';

interface AvatarProps {
  userId: string;
  avatarId?: string;
  size?: number;
  className?: string;
}

export function Avatar({ userId, avatarId, size = 36, className }: AvatarProps) {
  const svgString = minidenticon(userId, 80, 50);
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

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
      <AvatarFallback className="bg-transparent">
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
}
