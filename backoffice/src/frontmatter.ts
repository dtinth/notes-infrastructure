/**
 * Small edits to a note's front matter, made on the text itself so that
 * everything else in it stays exactly as written.
 */

/** Today as YYYY-MM-DD, in the browser's time zone. */
export function today() {
  return new Date().toLocaleDateString('sv')
}

/** Sets `public: true`, and `created` if the note doesn't have one. */
export function makePublic(source: string, date = today()) {
  return editFrontMatter(source, (lines) => {
    const index = lines.findIndex((line) => /^public:/.test(line))
    if (index >= 0) lines[index] = 'public: true'
    else lines.unshift('public: true')
    if (!lines.some((line) => /^created:/.test(line))) lines.push(`created: ${date}`)
  })
}

/** Appends an entry to `updates`, the note's revision history. */
export function addRevision(source: string, description: string, date = today()) {
  const entry = [`  - date: ${date}`, `    description: ${yamlString(description)}`]
  return editFrontMatter(source, (lines) => {
    const start = lines.findIndex((line) => /^updates:\s*$/.test(line))
    if (start < 0) {
      lines.push('updates:', ...entry)
      return
    }
    // The list goes on for as long as lines are indented or list items.
    let end = start + 1
    while (end < lines.length && /^(\s|-|$)/.test(lines[end])) end++
    while (end > start + 1 && !lines[end - 1].trim()) end--
    lines.splice(end, 0, ...entry)
  })
}

function editFrontMatter(source: string, edit: (lines: string[]) => void) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n?---(\r?\n|$)/)
  const lines = match ? (match[1] ? match[1].split(/\r?\n/) : []) : []
  edit(lines)
  const body = match ? source.slice(match[0].length) : source
  return `---\n${lines.join('\n')}\n---\n${body}`
}

/** A YAML scalar for `text`: plain when that is unambiguous, else quoted. */
function yamlString(text: string) {
  const plain =
    /^[^\s\-?:,[\]{}#&*!|>'"%@`]/.test(text) &&
    !/: |\s#|:$|\s$|[\n\t]/.test(text) &&
    !/^(true|false|yes|no|on|off|null|~|[-+.\d].*)$/i.test(text)
  return plain ? text : JSON.stringify(text)
}
