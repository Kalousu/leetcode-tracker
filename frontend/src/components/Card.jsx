import { useEffect, useRef, useState } from "react"
import { Button, Card as HCard, Chip } from "@heroui/react"
import EditorModule from "react-simple-code-editor"
import Prism from "prismjs" // enthält schon clike und javascript
import "prismjs/components/prism-python"
import "prismjs/components/prism-java"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-csharp"
import "prismjs/components/prism-go"
import "prismjs/components/prism-rust"
import "prismjs/components/prism-kotlin"
import "prismjs/components/prism-swift"
import "prismjs/components/prism-typescript"
import "prismjs/themes/prism.css"
import "./Card.css"

// Das Paket ist CommonJS (exports.default); je nach Bundler kommt das Modul-Objekt statt der Komponente an
const Editor = EditorModule.default ?? EditorModule

const DIFFICULTY_COLOR = {
    Easy: "success",
    Medium: "warning",
    Hard: "danger",
}

// Verlauf für den Rahmen je nach Schwierigkeit
const BORDER_GRADIENT = {
    Easy: "from-emerald-400 via-sky-400 to-emerald-500",
    Medium: "from-amber-400 via-orange-400 to-yellow-500",
    Hard: "from-rose-500 via-fuchsia-500 to-red-500",
}

const LANGUAGES = ["Python", "JavaScript", "TypeScript", "Java", "C++", "C", "C#", "Go", "Rust", "Kotlin", "Swift", "Sonstige"]

const EXTENSION_TO_LANGUAGE = {
    py: "Python", js: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript",
    java: "Java", cpp: "C++", cc: "C++", c: "C", cs: "C#", go: "Go", rs: "Rust", kt: "Kotlin", swift: "Swift",
}

// Anzeigename -> Prism-Grammatik
const PRISM_LANGUAGE = {
    Python: "python", JavaScript: "javascript", TypeScript: "typescript", Java: "java",
    "C++": "cpp", C: "c", "C#": "csharp", Go: "go", Rust: "rust", Kotlin: "kotlin", Swift: "swift",
}

function highlight(code, language) {
    const key = PRISM_LANGUAGE[language]
    const grammar = key && Prism.languages[key]
    // Ohne Grammatik (z. B. "Sonstige") den Code nur escapen
    return grammar ? Prism.highlight(code, grammar, key) : Prism.util.encode(code).toString()
}

const MAX_FILE_SIZE = 200 * 1024 // 200 KB reicht für Code locker und bleibt weit unter Firestores 1-MB-Limit

const fieldClass =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"

// Beschreibung: ab etwa 10 Zeilen eingeklappt mit "Mehr anzeigen"
const DESCRIPTION_MAX_HEIGHT = 224 // px, ca. 10 Zeilen

function Description({ html }) {
    const ref = useRef(null)
    const [expanded, setExpanded] = useState(false)
    const [overflowing, setOverflowing] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        // scrollHeight ist auch bei abgeschnittenem Text die volle Höhe
        const measure = () => setOverflowing(el.scrollHeight > DESCRIPTION_MAX_HEIGHT + 8)
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
    }, [html])

    const collapsed = overflowing && !expanded

    return (
        <div>
            <div className="relative">
                <div
                    ref={ref}
                    className="description overflow-hidden"
                    style={collapsed ? { maxHeight: DESCRIPTION_MAX_HEIGHT } : undefined}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
                {collapsed && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-200 to-transparent" />
                )}
            </div>
            {overflowing && (
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    aria-expanded={expanded}
                    className="mt-1 cursor-pointer text-sm font-semibold text-sky-700 hover:underline"
                >
                    {expanded ? "Weniger anzeigen ▴" : "Mehr anzeigen ▾"}
                </button>
            )}
        </div>
    )
}

function Solution({ titleSlug, notes = "", code = "", language = "Python", onSave }) {
    const [draft, setDraft] = useState({ notes, code, language })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    const dirty = draft.notes !== notes || draft.code !== code || draft.language !== language
    const update = (patch) => {
        setDraft((d) => ({ ...d, ...patch }))
        setMessage(null)
    }

    const handleFile = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = "" // gleiche Datei später erneut wählbar
        if (!file) return
        if (file.size > MAX_FILE_SIZE) {
            setMessage(`Datei ist zu groß (max. ${MAX_FILE_SIZE / 1024} KB)`)
            return
        }
        const text = await file.text()
        const ext = file.name.split(".").pop().toLowerCase()
        update({ code: text, language: EXTENSION_TO_LANGUAGE[ext] ?? draft.language })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(draft)
            setMessage("Gespeichert")
        } catch (err) {
            setMessage(`Fehler: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3">
            <h3 className="text-sm font-bold">Meine Lösung</h3>

            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={draft.language}
                    onChange={(e) => update({ language: e.target.value })}
                    aria-label="Sprache"
                    className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
                <label className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                    Datei hochladen
                    <input type="file" onChange={handleFile} className="hidden" />
                </label>
            </div>

            <div className="max-h-96 overflow-auto rounded-xl border border-gray-300 bg-white focus-within:border-sky-500">
                <Editor
                    value={draft.code}
                    onValueChange={(code) => update({ code })}
                    highlight={(code) => highlight(code, draft.language)}
                    placeholder="Code hier einfügen oder Datei hochladen"
                    textareaId={`code-${titleSlug}`}
                    padding={12}
                    tabSize={4}
                    insertSpaces
                    style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13, minHeight: "10rem" }}
                />
            </div>

            <textarea
                value={draft.notes}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Notizen (Idee, Laufzeit, was war schwierig ...)"
                aria-label="Notizen"
                rows={4}
                className={fieldClass}
            />

            <div className="flex items-center gap-3">
                <Button size="sm" variant="primary" onPress={handleSave} isDisabled={!dirty || saving}>
                    {saving ? "Speichert..." : "Speichern"}
                </Button>
                {message && <span className="text-sm text-slate-700">{message}</span>}
            </div>
        </div>
    )
}

function Card({ titleSlug, id, title, difficulty, content, tags = [], notes, code, language, onSaveSolution }) {
    const [open, setOpen] = useState(false)
    const gradient = BORDER_GRADIENT[difficulty] ?? "from-sky-400 to-indigo-500"

    return (
        <div className={`rounded-2xl bg-gradient-to-r ${gradient} p-[2px] shadow-md transition-shadow hover:shadow-xl`}>
            <HCard className="w-full rounded-[14px] bg-gray-200 gap-0">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer flex-col gap-1.5 px-3 py-2 text-left"
                >
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{id}. {title}</span>
                        <span className="flex items-center gap-3">
                            <Chip variant="soft" color={DIFFICULTY_COLOR[difficulty]}>{difficulty}</Chip>
                            <span
                                aria-hidden="true"
                                className={`inline-block transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                            >
                                ▾
                            </span>
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((t) => <Chip key={t.name} size="sm" variant="soft">{t.name}</Chip>)}
                        {code && <Chip size="sm" color="accent">Lösung</Chip>}
                        {notes && <Chip size="sm" color="accent">Notizen</Chip>}
                    </div>
                </button>

                {open && (
                    <div className="border-t border-black/10 px-3 pb-3 pt-2 text-sm">
                        {/* content ist HTML von LeetCode */}
                        <Description html={content} />
                        {onSaveSolution && (
                            <Solution titleSlug={titleSlug} notes={notes} code={code} language={language} onSave={onSaveSolution} />
                        )}
                    </div>
                )}
            </HCard>
        </div>
    )
}

export default Card;
