"use client"

import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon className="size-4 text-emerald-600 dark:text-emerald-400" weight="fill" />
        ),
        info: <InfoIcon className="size-4" weight="fill" />,
        warning: <WarningIcon className="size-4" weight="fill" />,
        error: <XCircleIcon className="size-4 text-destructive" weight="fill" />,
        loading: <SpinnerIcon className="size-4 animate-spin" />,
      }}
      position="top-center"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      {...props}
    />
  )
}

export { Toaster }
