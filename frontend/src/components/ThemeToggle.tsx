
import { useTheme } from './ThemeProvider'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? 'Switch to light mode'
          : 'Switch to dark mode'
      }
      aria-pressed={isDark}
      title={
        isDark
          ? 'Switch to Light Mode'
          : 'Switch to Dark Mode'
      }
      className="
        inline-flex h-11 w-11 items-center justify-center
        rounded-xl border border-slate-200
        bg-white text-slate-700
        transition-colors duration-200
        hover:bg-slate-100
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-cyan-500
        dark:border-slate-700
        dark:bg-slate-800
        dark:text-cyan-300
        dark:hover:bg-slate-700
      "
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.47 9.47Z" />
        </svg>
      )}
    </button>
  )
}

export default ThemeToggle
