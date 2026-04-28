interface SpriteIconProps {
  name: string
  size?: number
  className?: string
}

export function SpriteIcon({ name, size = 20, className }: SpriteIconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  )
}
