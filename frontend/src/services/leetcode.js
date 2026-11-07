import axios from 'axios'


const client = axios.create({
  baseURL: '/leetcode-graphql',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

async function graphql(query, variables = {}) {
  const { data } = await client.post('', { query, variables })
  if (data.errors?.length) {
    throw new Error(data.errors[0].message)
  }
  return data.data
}

const STATS_QUERY = `
  query userStats($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats: submitStatsGlobal {
        acSubmissionNum { difficulty count }
      }
    }
  }
`

const RECENT_AC_QUERY = `
  query recentAc($username: String!, $limit: Int) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id title titleSlug timestamp
    }
  }
`

export async function getSolvedStats(username) {
  const data = await graphql(STATS_QUERY, { username })
  if (!data.matchedUser) throw new Error(`User "${username}" nicht gefunden`)
  return data.matchedUser.submitStats.acSubmissionNum
}


export async function getRecentSolved(username, limit = 20) {
  const data = await graphql(RECENT_AC_QUERY, { username, limit })
  return data.recentAcSubmissionList.map((s) => ({
    ...s,
    solvedAt: new Date(Number(s.timestamp) * 1000),
  }))
}

const QUESTION_QUERY = `
  query question($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      topicTags { name }
    }
  }
`

export async function getQuestion(titleSlug) {
  const data = await graphql(QUESTION_QUERY, { titleSlug })
  return data.question
}

// Aus einer URL (https://leetcode.com/problems/two-sum/...) oder einem Slug/Titel den Slug machen
export function extractSlug(input) {
  const text = input.trim()
  const match = text.match(/leetcode\.[a-z]+\/problems\/([^/?#\s]+)/i)
  if (match) return match[1].toLowerCase()
  return text.toLowerCase().replace(/\s+/g, '-')
}

// Frage holen und in das Format bringen, das wir speichern
export async function fetchProblem(titleSlug, solvedAt = null, source = 'manual') {
  const q = await getQuestion(titleSlug)
  if (!q) throw new Error(`Aufgabe "${titleSlug}" nicht gefunden`)
  return {
    titleSlug: q.titleSlug,
    questionFrontendId: q.questionFrontendId,
    title: q.title,
    difficulty: q.difficulty,
    content: q.content ?? '',
    topicTags: q.topicTags ?? [],
    solvedAt, // ms seit 1970 oder null (z. B. bei manuell nachgetragenen)
    source,
  }
}

// Letzte gelöste Aufgaben (max. 20, das ist LeetCodes Limit) inkl. Beschreibung
export async function getSolvedProblems(username, limit = 20) {
  const recent = await getRecentSolved(username, limit)
  const firstSeen = new Map() // Slug -> neuester Zeitstempel (Liste ist neueste zuerst)
  for (const s of recent) {
    if (!firstSeen.has(s.titleSlug)) firstSeen.set(s.titleSlug, s.solvedAt.getTime())
  }
  return Promise.all(
    [...firstSeen].map(([slug, ts]) => fetchProblem(slug, ts, 'sync'))
  )
}
