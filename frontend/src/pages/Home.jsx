"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { userDataContext } from "../context/UserContext"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import aiImg from "../assets/ai.gif"
import { CgMenuRight } from "react-icons/cg"
import { RxCross1 } from "react-icons/rx"
import userImg from "../assets/user.gif"
import { FiMic, FiVolume2, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi"

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext)
  const navigate = useNavigate()
  const [listening, setListening] = useState(false)
  const [userText, setUserText] = useState("")
  const [aiText, setAiText] = useState("")
  const [displayedAiText, setDisplayedAiText] = useState("")
  const isSpeakingRef = useRef(false)
  const recognitionRef = useRef(null)
  const [ham, setHam] = useState(false)
  const isRecognizingRef = useRef(false)
  const synth = window.speechSynthesis
  const [historyOpen, setHistoryOpen] = useState(false)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)

  const handleLogOut = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true })
      setUserData(null)
      navigate("/signin")
    } catch (error) {
      setUserData(null)
      console.log(error)
    }
  }

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current?.start()
        console.log("Recognition requested to start")
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Start error:", error)
        }
      }
    }
  }

  const speak = (text) => {
    // Clean the text before speaking to remove undefined
    const cleanText = text ? String(text).replace(/undefined/g, '').trim() : ''
    if (!cleanText) return
    
    const utterence = new SpeechSynthesisUtterance(cleanText)
    utterence.lang = "hi-IN"
    const voices = window.speechSynthesis.getVoices()
    const hindiVoice = voices.find((v) => v.lang === "hi-IN")
    if (hindiVoice) {
      utterence.voice = hindiVoice
    }

    isSpeakingRef.current = true
    utterence.onend = () => {
      setAiText("")
      isSpeakingRef.current = false
      setTimeout(() => {
        startRecognition()
      }, 800)
    }
    synth.cancel()
    synth.speak(utterence)
  }

  const handleCommand = (data) => {
    const { type, userInput, response } = data
    
    // Clean the response before speaking
    let cleanResponse = ''
    if (response) {
      cleanResponse = String(response)
        .replace(/undefined/gi, '')
        .replace(/null/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    if (cleanResponse) {
      speak(cleanResponse)
    }

    if (type === "google-search") {
      const query = encodeURIComponent(userInput)
      window.open(`https://www.google.com/search?q=${query}`, "_blank")
    }
    if (type === "calculator-open") {
      window.open(`https://www.google.com/search?q=calculator`, "_blank")
    }
    if (type === "instagram-open") {
      window.open(`https://www.instagram.com/`, "_blank")
    }
    if (type === "facebook-open") {
      window.open(`https://www.facebook.com/`, "_blank")
    }
    if (type === "weather-show") {
      window.open(`https://www.google.com/search?q=weather`, "_blank")
    }

    if (type === "youtube-search" || type === "youtube-play") {
      const query = encodeURIComponent(userInput)
      window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank")
    }
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.lang = "en-US"
    recognition.interimResults = false

    recognitionRef.current = recognition

    let isMounted = true

    const startTimeout = setTimeout(() => {
      if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current) {
        try {
          recognition.start()
          console.log("Recognition requested to start")
        } catch (e) {
          if (e.name !== "InvalidStateError") {
            console.error(e)
          }
        }
      }
    }, 1000)

    recognition.onstart = () => {
      isRecognizingRef.current = true
      setListening(true)
    }

    recognition.onend = () => {
      isRecognizingRef.current = false
      setListening(false)
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start()
              console.log("Recognition restarted")
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e)
            }
          }
        }, 1000)
      }
    }

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error)
      isRecognizingRef.current = false
      setListening(false)
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start()
              console.log("Recognition restarted after error")
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e)
            }
          }
        }, 1000)
      }
    }

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim()
      if (transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        setAiText("")
        // Remove assistant name from displayed text and clean it up
        const cleanedTranscript = transcript
          .replace(new RegExp(userData.assistantName, 'gi'), '')
          .trim()
          .replace(/^[,.\s]+|[,.\s]+$/g, '') // Remove leading/trailing punctuation and spaces
        
        setUserText(cleanedTranscript)
        recognition.stop()
        isRecognizingRef.current = false
        setListening(false)
        const data = await getGeminiResponse(transcript)
        handleCommand(data)
        // Clean the AI response more thoroughly to remove undefined
        let cleanResponse = ''
        if (data && data.response) {
          cleanResponse = String(data.response)
            .replace(/undefined/gi, '') // Remove "undefined" (case insensitive)
            .replace(/null/gi, '') // Remove "null" 
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim() // Remove leading/trailing spaces
        }
        setAiText(cleanResponse)
        setUserText("")
      }
    }

    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`)
    greeting.lang = "hi-IN"
    window.speechSynthesis.speak(greeting)

    return () => {
      isMounted = false
      clearTimeout(startTimeout)
      recognition.stop()
      setListening(false)
      isRecognizingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!aiText) {
      setDisplayedAiText("")
      return
    }
    setDisplayedAiText("")
    let i = 0
    const interval = setInterval(() => {
      setDisplayedAiText((prev) => prev + aiText[i])
      i++
      if (i >= aiText.length) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [aiText])

  const statusText = listening
    ? "Listening…"
    : isSpeakingRef.current
      ? "Speaking…"
      : `Say "${userData?.assistantName}" to wake me`

  const clearHistory = () => {
    if (!userData?.history?.length) return
    const ok = window.confirm("Clear all history?")
    if (!ok) return
    setUserData({ ...userData, history: [] })
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1220]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CgMenuRight
              className="lg:hidden text-white w-[24px] h-[24px] cursor-pointer"
              onClick={() => setHam(true)}
              aria-label="Open menu"
            />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10">
                {userData?.assistantImage ? (
                  <img
                    src={userData.assistantImage || "/placeholder.svg"}
                    alt={`${userData?.assistantName || "Assistant"} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-white/10" />
                )}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm text-gray-300">Your AI Assistant</span>
                <span className="font-semibold text-base">{userData?.assistantName || "Assistant"}</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button
              className="min-w-[120px] h-10 px-4 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              onClick={() => navigate("/customize")}
            >
              Customize
            </button>
            <button
              className="min-w-[100px] h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              onClick={handleLogOut}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-30 lg:hidden bg-black/50 backdrop-blur-md p-5 flex flex-col gap-5 transition-transform ${ham ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
      >
        <RxCross1
          className="text-white absolute top-5 right-5 w-[24px] h-[24px] cursor-pointer"
          onClick={() => setHam(false)}
          aria-label="Close menu"
        />
        <div className="pt-10 flex flex-col gap-3">
          <button
            className="min-w-[150px] h-12 px-5 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            onClick={() => {
              setHam(false)
              navigate("/customize")
            }}
          >
            Customize your Assistant
          </button>
          <button
            className="min-w-[150px] h-12 px-5 rounded-full bg-white text-black text-sm font-semibold transition-colors"
            onClick={handleLogOut}
          >
            Log Out
          </button>
        </div>

        <div className="w-full h-px bg-white/20 my-3" />
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">History</h2>
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
              onClick={clearHistory}
              aria-label="Clear history"
            >
              <span className="inline-flex items-center gap-1">
                <FiTrash2 className="h-4 w-4" /> Clear
              </span>
            </button>
            <button
              className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
              onClick={() => setMobileHistoryOpen((v) => !v)}
              aria-expanded={mobileHistoryOpen}
              aria-controls="mobile-history-list"
            >
              <span className="inline-flex items-center gap-1">
                {mobileHistoryOpen ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                {mobileHistoryOpen ? "Hide" : "Show"}
              </span>
            </button>
          </div>
        </div>


            

        {mobileHistoryOpen && (
          <div id="mobile-history-list" className="w-full max-h-[50vh] overflow-y-auto flex flex-col gap-3">
            {userData.history?.length ? (
              userData.history.map((his, idx) => (
                <div key={idx} className="text-gray-300 text-sm bg-white/5 rounded-lg p-3" title={his}>
                  <span className="line-clamp-2 text-pretty">{his}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No history yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        {/* Sidebar (Desktop) */}
        <aside className="hidden lg:flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-3">Note:- Always mention the assistant's name in your request for best results.</h3>
            
          </div>

        {/* Conversation Card */}
        <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur px-4 sm:px-5 py-6 flex flex-col items-center gap-6">
          {/* Status pill */}
          <div className="w-full flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${listening ? "bg-emerald-400" : "bg-gray-400"}`}
                aria-hidden="true"
              />
              <span className="sr-only">Assistant status:</span>
              <span aria-live="polite">{statusText}</span>
            </div>
            <div className="hidden md:flex items-center gap-3 text-gray-300">
              <FiMic className={`h-5 w-5 ${listening ? "text-emerald-400" : "text-gray-400"}`} aria-hidden="true" />
              <FiVolume2
                className={`h-5 w-5 ${isSpeakingRef.current ? "text-emerald-400" : "text-gray-400"}`}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Assistant visual */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-28 w-28 sm:h-32 sm:w-32 md:h-36 md:w-36 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg">
              {userData?.assistantImage ? (
                <img
                  src={userData.assistantImage || "/placeholder.svg"}
                  alt={`${userData?.assistantName || "Assistant"} avatar large`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-white/10" />
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-balance">
              I'm {userData?.assistantName || "your AI assistant"}
            </h1>
          </div>

          {/* Chat area */}
          <div className="w-full max-w-full sm:max-w-2xl min-h-[160px] sm:min-h-[180px] rounded-2xl border border-white/10 bg-[#0b1220]/60 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
            {!aiText && !userText && (
              <div className="w-full flex flex-col items-center justify-center gap-3 py-6">
                <img src={userImg || "/placeholder.svg"} alt="User idle" className="w-28 opacity-90" />
                <p className="text-gray-400 text-sm text-center">
                  Try saying "{userData?.assistantName || "Assistant"} open calculator" or "
                  {userData?.assistantName || "Assistant"} search weather".
                </p>
              </div>
            )}

            {userText && (
              <div className="self-end max-w-[85%] rounded-2xl bg-blue-500 text-white px-4 py-3">
                <p className="text-sm leading-relaxed">{userText}</p>
              </div>
            )}

            {(aiText || displayedAiText) && (
              <div className="self-start max-w-[85%] rounded-2xl bg-white/10 px-4 py-3">
                <div className="flex items-start gap-3">
                  <img src={aiImg || "/placeholder.svg"} alt="Assistant responding" className="w-7 h-7 mt-0.5" />
                  <p className="text-sm leading-relaxed text-gray-100" aria-live="polite">
                    {displayedAiText || aiText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/90">History</h3>
              <div className="flex items-center gap-2">
                <button
                  className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                  onClick={clearHistory}
                  aria-label="Clear history"
                >
                  <span className="inline-flex items-center gap-1">
                    <FiTrash2 className="h-4 w-4" /> Clear
                  </span>
                </button>
                <button
                  className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  aria-controls="desktop-history-list"
                >
                  <span className="inline-flex items-center gap-1">
                    {historyOpen ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                    {historyOpen ? "Hide" : "Show"}
                  </span>
                </button>
              </div>
            </div>
            {historyOpen && (
              <div id="desktop-history-list" className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto">
                {userData.history?.length ? (
                  userData.history.map((his, idx) => (
                    <div
                      key={idx}
                      className="text-gray-300 text-sm bg-white/5 hover:bg-white/10 transition-colors rounded-lg p-3"
                      title={his}
                    >
                      <span className="line-clamp-2 text-pretty">{his}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No history yet.</p>
                )}
              </div>
            )}
          </div>
        </aside>

        
      </main>
    </div>
  )
}

export default Home