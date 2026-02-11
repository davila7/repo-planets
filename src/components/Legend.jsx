import { getUniqueLanguages } from '../services/languageColors'

export default function Legend({ planets }) {
  const languages = getUniqueLanguages(planets)

  if (languages.length === 0) return null

  return (
    <div className="legend-overlay">
      <div className="legend-title">Languages</div>
      {languages.map((lang) => (
        <div key={lang.name} className="legend-item">
          <span className="legend-dot" style={{ background: lang.color }} />
          {lang.name}
        </div>
      ))}
    </div>
  )
}
