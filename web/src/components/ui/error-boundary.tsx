'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0d111a] select-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-3xl mb-4 text-amber-500">
            ⚠️
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {this.props.fallbackTitle || 'Unable to load channel view'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-sm">
            {this.state.error?.message || 'An unexpected rendering error occurred. You can safely try reloading this component.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            ↻ Retry View
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
