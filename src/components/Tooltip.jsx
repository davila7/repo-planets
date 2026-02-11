import { getLanguageColor } from '../services/languageColors'

export default function Tooltip({ data, position }) {
  if (!data || !position) return null

  const langColor = getLanguageColor(data.language)

  return (
    <div
      className="tooltip-overlay"
      style={{
        left: position.x + 16,
        top: position.y - 10,
        opacity: 1,
      }}
    >
      <div className="tooltip-card">
        <h3>
          <span className="lang-dot" style={{ background: langColor }} />
          {data.name}
        </h3>
        <div className="description">{data.description}</div>
        <div className="stats">
          <span className="stat">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
            </svg>
            {data.stars.toLocaleString()}
          </span>
          <span className="stat">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.5 0v.878a2.25 2.25 0 01-2.25 2.25h-1.5v2.128a2.251 2.251 0 11-1.5 0V8.5h-1.5A2.25 2.25 0 013.5 6.25v-.878a2.25 2.25 0 111.5 0zM5 3.25a.75.75 0 10-1.5 0 .75.75 0 001.5 0zm6.75.75a.75.75 0 10 0-1.5.75.75 0 000 1.5zM8 12.75a.75.75 0 10 0-1.5.75.75 0 000 1.5z" />
            </svg>
            {data.forks.toLocaleString()}
          </span>
          <span className="stat" style={{ color: langColor }}>
            {data.language}
          </span>
        </div>
      </div>
    </div>
  )
}
