/** Maps campus role ids → animal avatar assets (Yellove discovery mascots). */
export const ROLE_AVATARS = {
  builders: {
    animal: 'Beaver',
    src: '/avatars/builders-beaver.svg',
    file: 'builders-beaver.svg',
  },
  hackers: {
    animal: 'Fox',
    src: '/avatars/hackers-fox.svg',
    file: 'hackers-fox.svg',
  },
  creators: {
    animal: 'Peacock',
    src: '/avatars/creators-peacock.svg',
    file: 'creators-peacock.svg',
  },
  connectors: {
    animal: 'Dolphin',
    src: '/avatars/connectors-dolphin.svg',
    file: 'connectors-dolphin.svg',
  },
  leaders: {
    animal: 'Wolf',
    src: '/avatars/leaders-wolf.svg',
    file: 'leaders-wolf.svg',
  },
  planners: {
    animal: 'Spider',
    src: '/avatars/planners-spider.svg',
    file: 'planners-spider.svg',
  },
}

export function avatarForRole(roleOrId) {
  const id = typeof roleOrId === 'string' ? roleOrId : roleOrId?.id
  const meta = ROLE_AVATARS[id]
  if (!meta) return null
  const roleName =
    typeof roleOrId === 'object' && roleOrId?.name ? roleOrId.name : id
  return {
    ...meta,
    id,
    alt: `${meta.animal} — ${roleName}`,
  }
}
