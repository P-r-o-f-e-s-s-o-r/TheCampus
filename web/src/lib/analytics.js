import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from 'firebase/analytics'
import { getPerformance, trace } from 'firebase/performance'
import { app } from '../firebase'

let analytics = null
let performance = null
let quizTrace = null
let ready = false

export async function initTelemetry() {
  if (typeof window === 'undefined' || ready) return
  try {
    if (await isSupported()) {
      analytics = getAnalytics(app)
    }
  } catch (err) {
    console.warn('Analytics unavailable', err)
  }
  try {
    performance = getPerformance(app)
  } catch (err) {
    console.warn('Performance unavailable', err)
  }
  ready = true
}

export function track(eventName, params = {}) {
  if (!analytics) return
  try {
    logEvent(analytics, eventName, {
      ...params,
      app_surface: 'web_discovery',
    })
  } catch (err) {
    console.warn('track failed', eventName, err)
  }
}

export function trackScreen(screenName) {
  track('screen_view', {
    firebase_screen: screenName,
    firebase_screen_class: 'DiscoveryApp',
    screen_name: screenName,
  })
}

export function identifyUser(uid, props = {}) {
  if (!analytics || !uid) return
  try {
    setUserId(analytics, uid)
    if (Object.keys(props).length) {
      setUserProperties(analytics, props)
    }
  } catch (err) {
    console.warn('identifyUser failed', err)
  }
}

export function startQuizTrace() {
  if (!performance) return
  try {
    if (quizTrace) {
      quizTrace.stop()
      quizTrace = null
    }
    quizTrace = trace(performance, 'quiz_session')
    quizTrace.start()
  } catch (err) {
    console.warn('quiz trace start failed', err)
  }
}

export function stopQuizTrace(attrs = {}) {
  if (!quizTrace) return
  try {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return
      quizTrace.putAttribute(String(key).slice(0, 32), String(value).slice(0, 100))
    })
    quizTrace.stop()
  } catch (err) {
    console.warn('quiz trace stop failed', err)
  } finally {
    quizTrace = null
  }
}
