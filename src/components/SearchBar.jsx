import { useState } from 'react'

export default function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || loading) return

    // Accept full GitHub URL or just username
    let username = trimmed
    const match = trimmed.match(/github\.com\/([^/\s]+)/)
    if (match) username = match[1]

    onSearch(username)
  }

  return (
    <div className="search-overlay">
      <form className="search-container" onSubmit={handleSubmit}>
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="GitHub username or URL..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          spellCheck={false}
          autoFocus
        />
        <button className="search-btn" type="submit" disabled={loading || !value.trim()}>
          {loading ? 'Loading...' : 'Explore'}
        </button>
      </form>
    </div>
  )
}
