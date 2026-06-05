import { useState, useEffect } from 'react'

/** Returns true when the device has a touchscreen (iPad, iPhone, Android).
 *  iPadOS 13+ mimics a desktop in media queries, so we use maxTouchPoints
 *  which remains reliable across all modern touch devices. */
export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    )
  }, [])
  return isTouch
}
