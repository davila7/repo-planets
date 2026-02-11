import { useState, useCallback } from 'react'
import SolarSystem from './components/SolarSystem'
import SearchBar from './components/SearchBar'
import Tooltip from './components/Tooltip'
import Legend from './components/Legend'
import UserBadge from './components/UserBadge'
import { fetchUserRepos } from './services/github'

export default function App() {
  const [planets, setPlanets] = useState([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hoveredPlanet, setHoveredPlanet] = useState(null)
  const [tooltipPos, setTooltipPos] = useState(null)

  const handleSearch = useCallback(async (user) => {
    setLoading(true)
    setError(null)
    setPlanets([])
    setUsername('')

    try {
      const repos = await fetchUserRepos(user)
      if (repos.length === 0) {
        setError(`No public repos found for "${user}"`)
      } else {
        setPlanets(repos)
        setUsername(user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleHoverPlanet = useCallback((data, coords) => {
    setHoveredPlanet(data)
    setTooltipPos({ x: coords.clientX, y: coords.clientY })
  }, [])

  const handleUnhoverPlanet = useCallback(() => {
    setHoveredPlanet(null)
    setTooltipPos(null)
  }, [])

  return (
    <>
      {/* 3D Scene — always rendered */}
      <SolarSystem
        planets={planets}
        username={username}
        onHoverPlanet={handleHoverPlanet}
        onUnhoverPlanet={handleUnhoverPlanet}
      />

      {/* Search */}
      <SearchBar onSearch={handleSearch} loading={loading} />

      {/* Welcome screen */}
      {planets.length === 0 && !loading && !error && (
        <div className="welcome-overlay">
          <h1 className="welcome-title">Repo Planets</h1>
          <p className="welcome-subtitle">
            Enter a GitHub username to transform their repositories into a 3D solar system.
            Each planet's size, color, and orbit tell a story.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">Fetching repositories...</div>
        </div>
      )}

      {/* Error toast */}
      {error && <div className="error-toast">{error}</div>}

      {/* Tooltip on hover */}
      <Tooltip data={hoveredPlanet} position={tooltipPos} />

      {/* Bottom panels */}
      {planets.length > 0 && (
        <>
          <Legend planets={planets} />
          <UserBadge username={username} repoCount={planets.length} />
        </>
      )}
    </>
  )
}
