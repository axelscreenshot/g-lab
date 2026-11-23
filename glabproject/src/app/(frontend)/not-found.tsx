import Link from "next/link"
import { getTranslations } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"

/**
 * Custom not-found page for the frontend.
 * This renders when `notFound()` is called from any page in the (frontend) route group.
 *
 * Customize this component to match your app's design and provide helpful navigation.
 */
export default async function NotFound() {
  const t = getTranslations(await getLocale())
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-8 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t.notFound.title}</h1>
      <p className="mt-4 text-white/45">
        {t.notFound.copy}
      </p>
      <Link
        className="mt-6 font-medium text-violet-300 underline-offset-4 hover:underline"
        href="/"
      >
        &larr; {t.notFound.back}
      </Link>
    </main>
  )
}
