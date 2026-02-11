// Language colors based on GitHub's linguist
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  Shell: '#89e051',
  Lua: '#000080',
  R: '#198CE7',
  Perl: '#0298c3',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
  Erlang: '#B83998',
  Julia: '#a270ba',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Svelte: '#ff3e00',
  Astro: '#ff5a03',
  Zig: '#ec915c',
  Nim: '#ffc200',
  OCaml: '#3be133',
  'Objective-C': '#438eff',
  Jupyter: '#DA5B0B',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  Unknown: '#8b83a8',
}

export function getLanguageColor(language) {
  return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.Unknown
}

export function getUniqueLanguages(planets) {
  const langs = [...new Set(planets.map((p) => p.language))]
  return langs.map((lang) => ({ name: lang, color: getLanguageColor(lang) }))
}
