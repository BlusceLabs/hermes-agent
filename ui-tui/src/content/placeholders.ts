import { pick } from '../lib/text.js'

export const PLACEHOLDERS = [
  'Ask me anything…',
  'Try "explain this codebase"',
  'Try "write a test for…"',
  'Try "refactor the auth module"',
  'Try "/help" for commands',
  'Try "fix the lint errors"',
  'Try "how does the config loader work?"',
  'Try "?" for quick help'
]

export const PLACEHOLDER = pick(PLACEHOLDERS)
