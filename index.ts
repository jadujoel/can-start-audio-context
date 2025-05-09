declare global {
  interface Navigator {
    getAutoplayPolicy?: GetAudioPlayPolicy
  }
  interface Window {
    AudioContext?: AudioContext
    webkitAudioContext?: AudioContext
  }
}

declare const webkitAudioContext: typeof AudioContext

function Context(options: AudioContextOptions = {}) {
  if (typeof AudioContext === "undefined") {
    if (typeof webkitAudioContext === "undefined") {
      throw new Error("Audio Context is not defined")
    }
    return new webkitAudioContext(options)
  }
  return new AudioContext(options)
}

type GetAudioPlayPolicy = (type: "audiocontext") => "allowed" | "disallowed"

interface NavigatorWithAutoplayPolicy extends Navigator {
  getAutoplayPolicy: GetAudioPlayPolicy
}

function isNavigatorWithAutoPlayPolicy(navigator: Navigator): navigator is NavigatorWithAutoplayPolicy {
  return navigator.getAutoplayPolicy !== undefined
}

function contextRuns(context?: AudioContext): boolean {
  if (context !== undefined) {
    return context.state === "running"
  }
  context = Context()
  if (context.state === "running") {
    context.close().catch()
    return true
  } else {
    context.close().catch()
    return false
  }
}

function check(context?: AudioContext) {
  if (context?.state === "running") {
    return true
  }
  if (isNavigatorWithAutoPlayPolicy(navigator)) {
    return navigator.getAutoplayPolicy("audiocontext") === "allowed"
    // userActivation don't exist on ios14
  } else if (navigator.userActivation?.isActive) {
    return true
  } else if (navigator.userActivation?.hasBeenActive) {
    return contextRuns()
  }
  return false
}

/**
 * Starts an audio context without console warnings.
 *
 * @example
 * import { start } from "can-start-audio-context"
 * const ctx = await start(undefined, { latencyHint: "playback", sampleRate: 48_000 })
 * console.log(ctx.state) // "running"
 */
export function start(context?: AudioContext, contextOptions?: AudioContextOptions): Promise<AudioContext | never> {
  let intervalPtr = -1
  let state: "init" | "resolved" | "rejected" = "init"
  return new Promise<AudioContext>((resolve) => {
    async function done(context?: AudioContext) {
      if (state === "init") {
        if (context === undefined) {
          context = Context(contextOptions)
        }
        const ctx = context
        return ctx.resume().then(() => {
          clearInterval(intervalPtr)
          if (state === "init") {
            state = "resolved"
            resolve(ctx)
          }
        }).catch(console.warn)
      }
    }
    if (check(context)) {
      done(context)
      return
    }
    // we check once for this since user might have allowed autoplay
    // in "check" it only tries it if the user has already been active
    // not sure what we should do if user has intentionally blocked audio
    // i think we'll still spam the console every 200ms then
    // should test that and maybe add a counter and if user hasBeenActive
    // is true then we eventually stop the interval
    if (!isNavigatorWithAutoPlayPolicy(navigator) && contextRuns()) {
      done(context)
      return
    }

    window.addEventListener("click", () => {
      done(context)
    }, {
      once: true,
      capture: true,
      passive: true
    })

    window.addEventListener("touchend", () => {
      done(context)
    }, {
      once: true,
      capture: true,
      passive: true
    })

    intervalPtr = window.setInterval(() => {
      if (check()) {
        done(context)
        return
      }
    }, 200)
  })
}
