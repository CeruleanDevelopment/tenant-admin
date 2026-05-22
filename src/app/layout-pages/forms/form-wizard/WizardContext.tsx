"use client"
// app/components/WizardContext.tsx
import React, { createContext, useContext, useState } from "react"

export type WizardForm = {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  country?: string
  language?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  occupation?: string
  company?: string
  cardNumber?: string
  cardHolder?: string
  expiry?: string
  cvv?: string
  comments?: string
}

type WizardContextValue = {
  step: number
  next: () => void
  back: () => void
  goTo: (s: number) => void
}

const WizardContext = createContext<WizardContextValue | undefined>(undefined)

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<number>(1)
  const next = () => setStep((s) => Math.min(s + 1, 4))
  const back = () => setStep((s) => Math.max(s - 1, 1))
  const goTo = (s: number) => setStep(s)

  return (
    <WizardContext.Provider value={{ step, next, back, goTo }}>
      {children}
    </WizardContext.Provider>
  )
}

export const useWizard = () => {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error("useWizard must be used within WizardProvider")
  return ctx
}