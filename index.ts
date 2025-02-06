declare global {
  interface Navigator {
    getAutoplayPolicy?: GetAudioPlayPolicy
  }
}

type GetAudioPlayPolicy = (type: "audiocontext") => "allowed" | "disallowed"

interface NavigatorWithAutoplayPolicy extends Navigator {
  getAutoplayPolicy: GetAudioPlayPolicy
}

function isNavigatorWithAutoPlayPolicy(navigator: Navigator): navigator is NavigatorWithAutoplayPolicy {
  return navigator.getAutoplayPolicy !== undefined
}

function contextRuns(): boolean {
  const context = new AudioContext()
  if (context.state === "running") {
    context.close().catch()
    return true
  } else {
    context.close().catch()
    return false
  }
}

function check() {
  if (isNavigatorWithAutoPlayPolicy(navigator)) {
    if (navigator.getAutoplayPolicy("audiocontext") === "allowed") {
      return true
    }
  } else if (navigator.userActivation.isActive) {
    return true
  } else if (navigator.userActivation.hasBeenActive) {
    return contextRuns()
  }
  return false
}

export function canStart(): Promise<void> {
  return new Promise<void>((resolve => {
    if (check()) {
      resolve()
      return
    }
    // we check once for this since user might have allowed autoplay
    // in "check" it only tries it if the user has already been active
    // not sure what we should do if user has intentionally blocked audio
    // i think we'll still spam the console every 200ms then
    // should test that and maybe add a counter and if user hasBeenActive
    // is true then we eventually stop the interval
    if (contextRuns()) {
      return
    }
    let clearScheduled = false
    const ptr = setInterval(() => {
      if (check()) {
        clearInterval(ptr)
        resolve()
        return
      }
      if (navigator.userActivation.hasBeenActive && !clearScheduled) {
        // don't spam the user forever if they intentionally blocked sounds
        setTimeout(() => {
          clearInterval(ptr)
        }, 4_000)
        clearScheduled = true
      }
    }, 200)
  }))
}
