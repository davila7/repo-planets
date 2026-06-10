const API_BASE = 'https://api.github.com'

export async function fetchUserRepos(username) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=stars&direction=desc`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`User "${username}" not found`)
    if (res.status === 403) throw new Error('GitHub API rate limit exceeded. Try again later.')
    throw new Error(`GitHub API error: ${res.status}`)
  }

  const repos = await res.json()

  return repos
    .filter((r) => !r.fork)
    .slice(0, 30)
    .map(mapRepoToPlanet)
}

// Deterministic PRNG so a user's solar system always looks the same
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function activityFromPush(pushedAt) {
  if (!pushedAt) return 0.15
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86400000
  if (days < 30) return 1.0
  if (days < 180) return 0.65
  if (days < 365) return 0.4
  return 0.15
}

function mapRepoToPlanet(repo, index) {
  const stars = repo.stargazers_count
  const forks = repo.forks_count
  const rand = mulberry32(repo.id)

  // Size: logarithmic scale based on stars, min 0.35, max 2.4
  const size = Math.max(0.35, Math.min(2.4, 0.35 + Math.log2(stars + 1) * 0.19))

  // Orbit radius: spread planets out, influenced by forks
  const baseOrbit = 6 + index * 2.4
  const orbitRadius = baseOrbit + Math.log2(forks + 1) * 0.4

  // Kepler-ish: outer orbits move slower (speed ~ 1/sqrt(r))
  const orbitSpeed = 0.55 / Math.sqrt(orbitRadius) + 0.008

  // Orbital plane: slight ellipse + tilt for a natural look
  const eccentricity = 0.03 + rand() * 0.1
  const inclination = (rand() - 0.5) * 0.22
  const ascendingNode = rand() * Math.PI * 2

  const rotationSpeed = 0.25 + rand() * 0.5

  // Moons from forks: 1 → 1, 3 → 2, 7 → 3, 15+ → 4
  const moons = Math.min(4, Math.floor(Math.log2(forks + 1)))

  // Saturn-like rings for heavily-forked repos
  const hasRings = forks >= 20

  // Recent pushes make a planet glow with life
  const activity = repo.archived ? 0 : activityFromPush(repo.pushed_at)

  // Planet archetype drives the procedural surface shader
  let planetType
  if (repo.archived) {
    planetType = 'dead'
  } else if (size >= 1.35) {
    planetType = 'gas'
  } else {
    const roll = rand()
    planetType = roll < 0.45 ? 'rocky' : roll < 0.75 ? 'ice' : 'lava'
  }

  return {
    id: repo.id,
    index,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || 'No description',
    language: repo.language || 'Unknown',
    stars,
    forks,
    url: repo.html_url,
    size,
    orbitRadius,
    orbitSpeed,
    eccentricity,
    inclination,
    ascendingNode,
    rotationSpeed,
    initialAngle: (index / 30) * Math.PI * 2 + rand() * 0.6,
    moons,
    hasRings,
    activity,
    archived: !!repo.archived,
    planetType,
    seed: rand(),
  }
}
