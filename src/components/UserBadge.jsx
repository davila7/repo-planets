export default function UserBadge({ username, repoCount }) {
  return (
    <div className="username-badge">
      <img
        src={`https://github.com/${username}.png?size=64`}
        alt={username}
        loading="lazy"
      />
      <div>
        <div className="name">@{username}</div>
        <div className="repo-count">{repoCount} planets</div>
      </div>
    </div>
  )
}
