import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { database } from './firebase'
import { fetchProblem, getRecentSolved } from './leetcode'

// users/{uid}/problems/{titleSlug}
const problemsCol = (uid) => collection(database, 'users', uid, 'problems')
// users/{uid}/deleted/{titleSlug}: gelöschte Aufgaben, damit der LeetCode-Abgleich sie nicht wieder hinzufügt
const deletedCol = (uid) => collection(database, 'users', uid, 'deleted')

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
  const batch = writeBatch(database)
  batch.set(doc(problemsCol(uid), fields.titleSlug), fields, { merge: true })
  batch.delete(doc(deletedCol(uid), fields.titleSlug)) // bewusst wieder hinzugefügt
  await batch.commit()
  return problem
}

// Aufgabe löschen (samt Lösung und Notizen) und für den Abgleich als gelöscht merken
export async function deleteProblem(uid, titleSlug) {
  const batch = writeBatch(database)
  batch.delete(doc(problemsCol(uid), titleSlug))
  batch.set(doc(deletedCol(uid), titleSlug), { titleSlug, deletedAt: Date.now() })
  await batch.commit()
}

// Eigene Lösung und Notizen zu einer Aufgabe speichern
export function saveSolution(uid, titleSlug, { notes, code, language }) {
  return saveProblem(uid, { titleSlug, notes, code, language })
}

// Letzte 20 gelöste Aufgaben von LeetCode holen und neue in Firestore speichern.
// knownSlugs: Slugs, die schon gespeichert sind (werden nicht erneut geladen).
export async function syncRecentSolved(uid, username, knownSlugs) {
  const [recent, deletedSnap] = await Promise.all([
    getRecentSolved(username, 20),
    getDocs(deletedCol(uid)),
  ])
  const deleted = new Set(deletedSnap.docs.map((d) => d.id))
  const fresh = new Map()
  for (const s of recent) {
    if (!knownSlugs.has(s.titleSlug) && !deleted.has(s.titleSlug) && !fresh.has(s.titleSlug)) {
      fresh.set(s.titleSlug, s.solvedAt.getTime())
    }
  }
  const problems = await Promise.all(
    [...fresh].map(([slug, ts]) => fetchProblem(slug, ts, 'sync'))
  )
  await Promise.all(problems.map((p) => saveProblem(uid, p)))
  return problems.length
}
