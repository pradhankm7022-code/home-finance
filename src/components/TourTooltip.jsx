import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'

export default function TourTooltip({ steps, storageKey, onDone, onStep }) {
  const [step, setStep] = useState(() => {
    if (localStorage.getItem(storageKey)) return -1
    const saved = parseInt(localStorage.getItem(storageKey + '_step') || '0', 10)
    return saved
  })
  const [rect, setRect] = useState(null)

  const done = useCallback(() => {
    localStorage.setItem(storageKey, 'done')
    localStorage.removeItem(storageKey + '_step')
    setStep(-1)
    onDone?.()
  }, [storageKey, onDone])

  // Measure target element position
  useEffect(() => {
    if (step < 0 || step >= steps.length) return

    const current = steps[step]

    function measure() {
      const el = document.querySelector(`[data-tour="${current.target}"]`)
      if (el) {
        setRect(el.getBoundingClientRect())
      }
    }

    // Small delay to let DOM settle (tab switches, navigation)
    const id = setTimeout(measure, 120)

    // Re-measure on resize/scroll
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, steps])

  // Persist current step
  useEffect(() => {
    if (step >= 0) localStorage.setItem(storageKey + '_step', String(step))
  }, [step, storageKey])

  if (step < 0 || step >= steps.length || !rect) return null

  const current = steps[step]
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Position tooltip above or below the target
  const TOOLTIP_W = 280
  const TOOLTIP_H = 160
  const PAD = 12

  const targetCenterX = rect.left + rect.width / 2
  const spaceBelow = vh - rect.bottom
  const spaceAbove = rect.top

  let tooltipTop, arrowOnTop
  if (spaceBelow >= TOOLTIP_H + PAD || spaceBelow >= spaceAbove) {
    tooltipTop = rect.bottom + PAD
    arrowOnTop = true
  } else {
    tooltipTop = rect.top - TOOLTIP_H - PAD
    arrowOnTop = false
  }

  let tooltipLeft = targetCenterX - TOOLTIP_W / 2
  tooltipLeft = Math.max(PAD, Math.min(tooltipLeft, vw - TOOLTIP_W - PAD))

  const arrowLeft = targetCenterX - tooltipLeft - 8

  return (
    <>
      {/* Highlight ring around target */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: 12,
          boxShadow: '0 0 0 4px #2563eb, 0 0 0 9999px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          zIndex: 9998,
          transition: 'all 0.2s ease',
        }}
      />

      {/* Tooltip card */}
      <div
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_W,
          zIndex: 9999,
        }}
      >
        {/* Arrow pointing to target */}
        {arrowOnTop && (
          <div style={{
            position: 'absolute',
            top: -8,
            left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - 24)),
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid white',
          }} />
        )}

        <div className="bg-white rounded-2xl shadow-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
          <div className="flex items-start justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">{current.title}</p>
            <button onClick={done} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{current.text}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{step + 1} / {steps.length}</span>
            <div className="flex gap-2">
              <button
                onClick={done}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip
              </button>
              {step < steps.length - 1 ? (
                <button
                  onClick={() => {
                    const next = step + 1
                    setRect(null)
                    setStep(next)
                    onStep?.(next, steps[next])
                  }}
                  className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={done}
                  className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>

        {!arrowOnTop && (
          <div style={{
            position: 'absolute',
            bottom: -8,
            left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - 24)),
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid white',
          }} />
        )}
      </div>
    </>
  )
}
