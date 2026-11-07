import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { database } from './firebase'
import { fetchProblem, getRecentSolved } from './leetcode'

// users/{uid}/problems/{titleSlug}
const problemsCol = (uid) => collection(database, 'users', uid, 'problems')

export function subscribeProblems(uid, onData, onError) {
  return onSnapshot(
    problemsCol(uid),
    (snap) => onData(snap.docs.map((d) => d.data())),
    onError
  )
}

export function saveProblem(uid, problem) {
  return setDoc(doc(problemsCol(uid), problem.titleSlug), problem, { merge: true })
}

// Manuell hinzufügen (Slug oder URL). Gibt die gespeicherte Aufgabe zurück.
export async function addProblemBySlug(uid, slug) {
  const problem = await fetchProblem(slug, null, 'manual')
  // solvedAt/source weglassen, damit eine schon gespeicherte Aufgabe ihr Datum behält
  // (merge lässt auch Notizen und Code unangetastet)
  const { solvedAt, source, ...fields } = problem
  void solvedAt
  void source
  await saveProblem(uid, fields)
  return problem
}

// Eigene Lösung und Notizen zu einer Aufgabe speichern
export function saveSolution(uid, titleSlug, { notes, code, language }) {
  return saveProblem(uid, { titleSlug, notes, code, language })
}

// Letzte 20 gelöste Aufgaben von LeetCode holen und neue in Firestore speichern.
// knownSlugs: Slugs, die schon gespeichert sind (werden nicht erneut geladen).
export async function syncRecentSolved(uid, username, knownSlugs) {
  const recent = await getRecentSolved(username, 20)
  const fresh = new Map()
  for (const s of recent) {
    if (!knownSlugs.has(s.titleSlug) && !fresh.has(s.titleSlug)) {
      fresh.set(s.titleSlug, s.solvedAt.getTime())
    }
  }
  const problems = await Promise.all(
    [...fresh].map(([slug, ts]) => fetchProblem(slug, ts, 'sync'))
  )
  await Promise.all(problems.map((p) => saveProblem(uid, p)))
  return problems.length
}
