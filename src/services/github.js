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

function mapRepoToPlanet(repo, index) {
  const stars = repo.stargazers_count
  const forks = repo.forks_count

  // Size: logarithmic scale based on stars, min 0.3, max 2.5
  const size = Math.max(0.3, Math.min(2.5, 0.3 + Math.log2(stars + 1) * 0.2))

  // Orbit radius: spread planets out, influenced by forks
  const baseOrbit = 4 + index * 2.2
  const orbitRadius = baseOrbit + Math.log2(forks + 1) * 0.5

  // Orbit speed: smaller orbits go faster
  const orbitSpeed = 0.15 / (index + 1) + 0.01

  // Rotation speed: random-ish but consistent
  const rotationSpeed = 0.3 + (stars % 10) * 0.05

  return {
    id: repo.id,
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
    rotationSpeed,
    initialAngle: (index / 30) * Math.PI * 2 + Math.random() * 0.5,
  }
}
