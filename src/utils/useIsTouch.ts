import { useState, useEffect } from 'react'

/** Returns true when the primary input is touch (iPad, iPhone, Android).
 *  Uses the CSS pointer media query which is reliable across modern browsers. */
export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])
  return isTouch
}
