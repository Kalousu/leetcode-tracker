import { useState, useEffect, useMemo } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { Alert, Button, Chip, Spinner, Tabs } from '@heroui/react'
import { auth, googleProvider } from './services/firebase'
import { extractSlug, getSolvedProblems, getSolvedStats } from './services/leetcode'
import { addProblemBySlug, deleteProblem, saveSolution, subscribeProblems, syncRecentSolved } from './services/problems'
import Card from './components/Card'
import './App.css'

const USERNAME = 'Kalousu'

const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 }

const selectClass =
  'aero-field h-10 rounded-xl px-2 text-sm'

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
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState(null)
  const [syncing, setSyncing] = useState(false)

  // Suche und Filter
  const [query, setQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const allTags = useMemo(
    () => [...new Set(problems.flatMap((p) => (p.topicTags ?? []).map((t) => t.name)))].sort(),
    [problems]
  )

  const filtersActive =
    query.trim() !== '' || difficultyFilter !== 'all' || tagFilter !== 'all' || statusFilter !== 'all'

  const resetFilters = () => {
    setQuery('')
    setDifficultyFilter('all')
    setTagFilter('all')
    setStatusFilter('all')
  }

  const sortedProblems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = problems.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !String(p.questionFrontendId).includes(q)) return false
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false
      if (tagFilter !== 'all' && !(p.topicTags ?? []).some((t) => t.name === tagFilter)) return false
      if (statusFilter === 'solution' && !p.code) return false
      if (statusFilter === 'no-solution' && p.code) return false
      if (statusFilter === 'notes' && !p.notes) return false
      return true
    })
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
  }, [problems, sortBy, query, difficultyFilter, tagFilter, statusFilter])

  const totalSolved = stats.find((s) => s.difficulty === 'All')?.count

  const login = () => signInWithPopup(auth, googleProvider).catch((e) => setError(e.message))
  const logout = () => signOut(auth)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newSlug.trim() || !uid) return
    setAdding(true)
    setAddError(null)
    try {
      await addProblemBySlug(uid, extractSlug(newSlug))
      setNewSlug('')
      setAddOpen(false)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = (titleSlug) => deleteProblem(uid, titleSlug)

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
      <header className="glass-bar sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="aero-orb">
              <span className="relative z-[1]">L</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              LeetCode Tracker
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="primary"
                  className="aero-btn"
                  aria-expanded={addOpen}
                  onPress={() => setAddOpen((o) => !o)}
                >
                  + Aufgabe
                </Button>
                {addOpen && (
                  <form
                    onSubmit={handleAdd}
                    onKeyDown={(e) => e.key === 'Escape' && setAddOpen(false)}
                    className="glass-panel absolute right-0 top-full z-20 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-2xl p-3"
                  >
                    <label htmlFor="add-slug" className="text-sm font-semibold text-slate-800">
                      Aufgabe hinzufügen
                    </label>
                    <input
                      id="add-slug"
                      autoFocus
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="LeetCode-URL oder Slug, z. B. two-sum"
                      className="aero-field h-10 rounded-xl px-3 text-sm"
                    />
                    {addError && <p className="text-sm text-red-700">{addError}</p>}
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      className="aero-btn h-10"
                      isDisabled={adding || !newSlug.trim()}
                    >
                      {adding ? 'Lädt...' : 'Hinzufügen'}
                    </Button>
                  </form>
                )}
              </div>
            )}
            <Chip variant="soft">@{USERNAME}</Chip>
            {authReady &&
              (user ? (
                <>
                  <span className="hidden text-sm text-slate-700 sm:inline">
                    {user.displayName ?? user.email}
                  </span>
                  <Button size="sm" variant="secondary" className="aero-btn-secondary" onPress={logout}>
                    Abmelden
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" className="aero-btn" onPress={login}>
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
                className="glass glass-gloss rounded-2xl p-4 text-center"
              >
                <p className="text-3xl font-bold text-slate-800">{count}</p>
                <p className="text-sm font-semibold text-slate-700">
                  {difficulty === 'All' ? 'Gesamt' : difficulty}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="glass flex flex-col gap-2.5 rounded-3xl p-5">
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

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen: Titel oder Nummer"
              aria-label="Suche"
              className="aero-field h-10 min-w-0 flex-1 rounded-xl px-3 text-sm"
            />
            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} aria-label="Schwierigkeit" className={selectClass}>
              <option value="all">Alle Schwierigkeiten</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Tag" className={selectClass}>
              <option value="all">Alle Tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {user && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className={selectClass}>
                <option value="all">Alle</option>
                <option value="solution">Mit Lösung</option>
                <option value="no-solution">Ohne Lösung</option>
                <option value="notes">Mit Notizen</option>
              </select>
            )}
            {filtersActive && (
              <Button size="sm" variant="secondary" className="aero-btn-secondary h-10" onPress={resetFilters}>
                Zurücksetzen
              </Button>
            )}
          </div>

          {authReady && !user && (
            <p className="text-sm text-slate-700">
              Du siehst nur die letzten 20 gelösten Aufgaben. Melde dich an, um alle zu speichern
              und eigene hinzuzufügen.
            </p>
          )}

          {user && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" className="aero-btn-secondary h-10" onPress={handleSync} isDisabled={syncing}>
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

          {!loading && problems.length > 0 && (
            <p className="text-sm text-slate-700">
              {filtersActive ? `${sortedProblems.length} von ${problems.length} Aufgaben` : `${problems.length} Aufgaben`}
            </p>
          )}

          {!loading && problems.length > 0 && sortedProblems.length === 0 && (
            <p className="py-6 text-center text-slate-700">Keine Treffer.</p>
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
              onDelete={uid ? () => handleDelete(p.titleSlug) : undefined}
            />
          ))}
        </section>
      </main>

      <footer className="glass-bar glass-bar-footer px-4 py-3 text-center text-sm text-slate-700">
        Daten von LeetCode
      </footer>
    </div>
  )
}

export default App
