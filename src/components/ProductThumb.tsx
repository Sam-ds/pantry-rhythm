import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'

interface ProductThumbProps {
  src: string
  name: string
  size?: 'small' | 'medium' | 'large'
  alt?: string
}

export function ProductThumb({ src, name, size = 'medium', alt }: ProductThumbProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <div className={`product-thumb product-thumb-${size}`} aria-hidden={alt ? undefined : 'true'}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="product-thumb-fallback">
          <Package size={size === 'large' ? 30 : size === 'small' ? 17 : 22} aria-hidden="true" />
          <span>{name.trim().slice(0, 1).toUpperCase() || '?'}</span>
        </div>
      )}
    </div>
  )
}
