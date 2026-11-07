import { useState, useEffect } from 'react'
import { getSolvedStats } from './services/leetcode'
import './App.css'

function App() {
  const[stats, setStats] = useState([])
  useEffect(() => {
    getSolvedStats('Kalousu').then(object => {
      setStats(object);
      console.log(object);
    }).catch(console.error)
  }, [])

  return (
    <>
      <header>
        <h1>Leetcode Tracker</h1>
        <ul>
          {stats.map(({ difficulty, count }) => (
            <li key={difficulty}>
              {difficulty}: {count}
            </li>
          ))}
        </ul>
      </header>
    </>
  )
}

export default App
