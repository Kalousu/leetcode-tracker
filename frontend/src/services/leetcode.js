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
