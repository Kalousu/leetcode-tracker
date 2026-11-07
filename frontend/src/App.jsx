import { useState, useEffect, useMemo } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { Alert, Button, Chip, Spinner, Tabs } from '@heroui/react'
import { auth, googleProvider } from './services/firebase'
import { extractSlug, getSolvedProblems, getSolvedStats } from './services/leetcode'
import { addProblemBySlug, saveSolution, subscribeProblems, syncRecentSolved } from './services/problems'
import Card from './components/Card'
import './App.css'

const USERNAME = 'Kalousu'

const DIFFICULTY_COLOR = {
  All: 'accent',
  Easy: 'success',
  Medium: 'warning',
  Hard: 'danger',
}

const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 }

const byNumber = (a, b) => Number(a.questionFrontendId) - Number(b.questionFrontendId)

function App() {
  const [sortBy, setSortBy] = useState('recent')
  const [problems, setProblems] = useState([])
  const [stats, setStats] = useState([])
  const [loadedFor, setLoadedFor] = useState(null) // für welche Quelle (uid/'live') zuletzt geladen wurde
  const [error, setError] = useState(null)

  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Login-Status beobachten
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setAuthReady(true)
      }),
    []
  )

  // Statistik (210 / Easy / Medium / Hard) kommt immer live von LeetCode
  useEffect(() => {
    getSolvedStats(USERNAME).then(setStats).catch((e) => setError(e.message))
  }, [])

  // Eingeloggt: gespeicherte Aufgaben aus Firestore (+ neue von LeetCode übernehmen).
  // Ausgeloggt: nur die letzten 20 live von LeetCode.
  const uid = user?.uid
  const sourceKey = authReady ? (uid ?? 'live') : null
  const loading = loadedFor !== sourceKey
  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    if (!uid) {
      getSolvedProblems(USERNAME)
        .then((p) => !cancelled && setProblems(p))
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoadedFor('live'))
      return () => {
        cancelled = true
      }
    }

    let synced = false
    const unsubscribe = subscribeProblems(
      uid,
      (data) => {
        setProblems(data)
        setLoadedFor(uid)
        if (!synced) {
          synced = true
          syncRecentSolved(uid, USERNAME, new Set(data.map((p) => p.titleSlug))).catch((e) =>
            setError(e.message)
          )
        }
      },
      (e) => {
        setError(e.message)
        setLoadedFor(uid)
      }
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [uid, authReady])

  const sortedProblems = useMemo(() => {
    const list = [...problems]
    if (sortBy === 'difficulty') {
      return list.sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty] ?? 99) - (DIFFICULTY_ORDER[b.difficulty] ?? 99) ||
          byNumber(a, b)
      )
    }
    if (sortBy === 'number') {
      return list.sort(byNumber)
    }
    // 'recent': neueste zuerst, manuell nachgetragene (ohne Datum) ans Ende
    return list.sort((a, b) => (b.solvedAt ?? -1) - (a.solvedAt ?? -1) || byNumber(b, a))
  }, [problems, sortBy])

  const totalSolved = stats.find((s) => s.difficulty === 'All')?.count

  const login = () => signInWithPopup(auth, googleProvider).catch((e) => setError(e.message))
  const logout = () => signOut(auth)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newSlug.trim() || !uid) return
    setAdding(true)
    setError(null)
    try {
      await addProblemBySlug(uid, extractSlug(newSlug))
      setNewSlug('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncRecentSolved(uid, USERNAME, new Set(problems.map((p) => p.titleSlug)))
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-white/30 bg-white/60 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-emerald-400 text-lg font-bold text-white shadow">
              L
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              LeetCode Tracker
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Chip variant="soft">@{USERNAME}</Chip>
            {authReady &&
              (user ? (
                <>
                  <span className="hidden text-sm text-slate-700 sm:inline">
                    {user.displayName ?? user.email}
                  </span>
                  <Button size="sm" variant="secondary" onPress={logout}>
                    Abmelden
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" onPress={login}>
                  Mit Google anmelden
                </Button>
              ))}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 py-6">
        {stats.length > 0 && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ difficulty, count }) => (
              <div
                key={difficulty}
                className="rounded-2xl border border-white/40 bg-white/60 p-4 text-center shadow-sm backdrop-blur-md"
              >
                <p className="text-3xl font-bold text-slate-800">{count}</p>
                <Chip size="sm" variant="soft" color={DIFFICULTY_COLOR[difficulty]}>
                  {difficulty === 'All' ? 'Gesamt' : difficulty}
                </Chip>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2.5 rounded-3xl border border-white/50 bg-white/75 p-5 shadow-lg backdrop-blur-lg">
          <Tabs selectedKey={sortBy} onSelectionChange={(key) => setSortBy(String(key))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Sortierung der gelösten Challenges">
                <Tabs.Tab id="recent">
                  Zuletzt gelöst
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="number">
                  Nach Nummer
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="difficulty">
                  Nach Schwierigkeit
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {authReady && !user && (
            <p className="text-sm text-slate-700">
              Du siehst nur die letzten 20 gelösten Aufgaben. Melde dich an, um alle zu speichern
              und eigene hinzuzufügen.
            </p>
          )}

          {user && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form onSubmit={handleAdd} className="flex flex-1 items-center gap-2">
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="Aufgabe hinzufügen: URL oder Slug, z. B. two-sum"
                  aria-label="LeetCode-URL oder Slug"
                  className="min-w-0 flex-1 h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
                />
                <Button type="submit" size="sm" variant="primary" className="h-10" isDisabled={adding || !newSlug.trim()}>
                  {adding ? 'Lädt...' : 'Hinzufügen'}
                </Button>
              </form>
              <Button size="sm" variant="secondary" className="h-10" onPress={handleSync} isDisabled={syncing}>
                {syncing ? 'Synchronisiert...' : 'Mit LeetCode abgleichen'}
              </Button>
              {totalSolved !== undefined && (
                <span className="text-sm text-slate-700">
                  Gespeichert: {problems.length} / {totalSolved}
                </span>
              )}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          )}

          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Etwas ist schiefgelaufen</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {sortedProblems.map((p) => (
            <Card
              key={p.titleSlug}
              titleSlug={p.titleSlug}
              id={p.questionFrontendId}
              title={p.title}
              difficulty={p.difficulty}
              content={p.content}
              tags={p.topicTags}
              notes={p.notes}
              code={p.code}
              language={p.language}
              onSaveSolution={uid ? (fields) => saveSolution(uid, p.titleSlug, fields) : undefined}
            />
          ))}
        </section>
      </main>

      <footer className="border-t border-white/30 bg-white/60 px-4 py-3 text-center text-sm text-slate-700 shadow-sm backdrop-blur-md">
        Daten von LeetCode
      </footer>
    </div>
  )
}

export default App
