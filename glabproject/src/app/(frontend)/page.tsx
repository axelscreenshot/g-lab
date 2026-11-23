import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, CheckCircle2, Clock3, Users2 } from 'lucide-react'
import { OnboardingPanel } from '@/components/onboarding-panel'
import { AccountUpgradePanel, AuthPanel } from '@/components/auth-panel'
import { LanguageSwitcher } from '@/components/language-switcher'
import { appAuth } from '@/lib/app-auth'
import { getTranslations } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'
import { getPayloadClient } from '@/lib/payload'
import { logoutAction } from '@/app/(frontend)/actions'

export default async function HomePage() {
  const locale = await getLocale()
  const t = getTranslations(locale)
  const user = await appAuth.currentUser()
  const isLegacyGuest = user?.email.endsWith('@guest.g-lab.local') ?? false
  const hasAccount = Boolean(user && !isLegacyGuest)
  const features = [
    { Icon: Users2, title: t.home.features[0][0], copy: t.home.features[0][1] },
    { Icon: Clock3, title: t.home.features[1][0], copy: t.home.features[1][1] },
    {
      Icon: CheckCircle2,
      title: t.home.features[2][0],
      copy: t.home.features[2][1],
    },
  ]
  const projects = user
    ? (
        await (await getPayloadClient()).find({
          collection: 'projects',
          depth: 0,
          limit: 6,
          overrideAccess: false,
          sort: '-updatedAt',
          user,
        })
      ).docs
    : []

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080914] text-[#f8f8ff]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-48 size-[34rem] rounded-full bg-[#6d5dfc]/30 blur-[120px]" />
        <div className="absolute -right-56 top-[18%] size-[38rem] rounded-full bg-[#d946ef]/18 blur-[140px]" />
        <div className="absolute bottom-[-18rem] left-[28%] size-[34rem] rounded-full bg-[#06b6d4]/16 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#080914_78%)]" />
      </div>

      <header className="relative z-10 mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-[1376px] items-center justify-between rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:mt-6 sm:px-5">
        <Link className="flex items-center gap-3" href="/">
          <Image
            alt="G-Lab"
            className="size-9 object-contain drop-shadow-[0_0_18px_rgba(124,109,255,0.42)]"
            height={40}
            priority
            src="/g-lab-mark.png"
            width={40}
          />
          <span className="text-base font-semibold tracking-[-0.03em]">G-Lab</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher locale={locale} returnTo="/" />
          {user ? (
            <>
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold">{user.displayName}</span>
              <span className="block max-w-48 truncate text-xs text-white/45">
                {isLegacyGuest ? t.common.accountSetupRequired : user.email}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                type="submit"
              >
                {t.common.signOut}
              </button>
            </form>
            </>
          ) : (
            <p className="hidden text-sm text-white/45 sm:block">{t.home.tagline}</p>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:gap-20 lg:px-12 lg:pb-24 lg:pt-24">
        <section className="flex flex-col justify-between lg:py-4">
          {user ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                {t.home.recentProjects}
              </p>
              <div className="min-h-[260px] rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-5">
                {projects.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((project) => (
                      <Link
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet-300/30 hover:bg-white/[0.08]"
                        href={`/projects/${project.id}`}
                        key={project.id}
                      >
                        <span
                          className="size-10 rounded-xl"
                          style={{ backgroundColor: project.coverColor || '#6668E8' }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {project.name}
                          </span>
                          <span className="block truncate text-xs text-white/40">
                            {project.course}
                          </span>
                      </span>
                        <ArrowUpRight className="size-4 text-white/35" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3.5 py-2 text-xs font-semibold text-violet-100 backdrop-blur-xl">
                  <span className="size-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_#a78bfa]" />
                  {t.home.eyebrow}
                </p>
                <h1 className="max-w-[780px] text-[clamp(3.5rem,8vw,7.5rem)] font-semibold leading-[0.87] tracking-[-0.075em]">
                  {t.home.headline}{' '}
                  <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                    {t.home.headlineAccent}
                  </span>
                </h1>
                <p className="mt-8 max-w-xl text-lg leading-8 text-white/55 sm:text-xl">
                  {t.home.intro}
                </p>
              </div>

              <div className="mt-14 grid max-w-2xl gap-3 sm:grid-cols-3">
                {features.map(({ Icon, title, copy }) => (
                  <div
                    className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075]"
                    key={title}
                  >
                    <Icon className="mb-7 size-5 text-violet-300 transition group-hover:text-cyan-300" />
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-white/45">{copy}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section
          aria-label={t.home.startAria}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_32px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
        >
          {hasAccount ? (
            <>
              <div className="mb-6">
                <p className="text-sm font-semibold text-white">
                  {t.home.startTitle}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  {t.home.startCopy}
                </p>
              </div>
              <OnboardingPanel locale={locale} />
            </>
          ) : isLegacyGuest && user ? (
            <AccountUpgradePanel displayName={user.displayName} locale={locale} />
          ) : (
            <>
              <div className="mb-6">
                <p className="text-sm font-semibold text-white">
                  {t.home.accountTitle}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  {t.home.accountCopy}
                </p>
              </div>
              <AuthPanel locale={locale} />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
