import { useState, useEffect } from 'react'
import { getSolvedProblems } from './services/leetcode'
import Card from './components/Card'
import './App.css'

const USERNAME = 'Kalousu'

function App() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSolvedProblems(USERNAME)
      .then(setProblems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <header className="p-6">
        <h1 className="text-3xl font-bold">Leetcode Tracker</h1>
      </header>
      <main className="flex flex-col gap-4 px-6 pb-6 max-w-3xl mx-auto">
        {loading && <p>Lade...</p>}
        {error && <p>Fehler: {error}</p>}
        {problems.map((p) => (
          <Card
            key={p.titleSlug}
            id={p.questionFrontendId}
            title={p.title}
            difficulty={p.difficulty}
            content={p.content}
            tags={p.topicTags}
          />
        ))}
      </main>
    </>
  )
}

export default App
