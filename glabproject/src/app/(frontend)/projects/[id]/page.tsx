import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Flag,
  LayoutDashboard,
  ListTodo,
  Milestone as MilestoneIcon,
  Plus,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import {
  createTaskAction,
  logoutAction,
  updateTaskStatusAction,
} from '@/app/(frontend)/actions'
import { LanguageSwitcher } from '@/components/language-switcher'
import {
  AddCheckInForm,
  AddMilestoneForm,
  DeadlineCountdown,
  MilestoneStatusButton,
} from '@/components/project-interactions'
import { appAuth } from '@/lib/app-auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { getLocale } from '@/lib/locale'
import { getPayloadClient } from '@/lib/payload'
import type { CheckIn, Milestone, Project, Task } from '@/payload-types'

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return String(value || '')
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const statusTone: Record<Task['status'], string> = {
  todo: 'bg-white/8 text-white/55',
  'in-progress': 'bg-violet-400/15 text-violet-200',
  review: 'bg-amber-300/15 text-amber-200',
  done: 'bg-emerald-300/15 text-emerald-200',
}

const fieldClass =
  'h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-violet-300/60 focus:ring-4 focus:ring-violet-400/10'
const textareaClass =
  'min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/60 focus:ring-4 focus:ring-violet-400/10'

type ProjectCopy = ReturnType<typeof getTranslations>['project']

function AddTask({
  milestones,
  project,
  copy,
}: {
  milestones: Milestone[]
  project: Project
  copy: ProjectCopy
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20">
        <Plus className="size-4" /> {copy.newTask}
      </summary>
      <form
        action={createTaskAction}
        className="absolute right-0 z-20 mt-3 grid w-[min(420px,calc(100vw-32px))] gap-3 rounded-2xl border border-white/10 bg-[#111222]/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl"
      >
        <input name="projectId" type="hidden" value={project.id} />
        <input className={fieldClass} name="title" placeholder={copy.taskTitle} required />
        <textarea
          className={textareaClass}
          name="description"
          placeholder={copy.taskDescription}
        />
        <div className="grid grid-cols-2 gap-3">
          <select className={fieldClass} name="assignee" required>
            <option value="">{copy.assignTo}</option>
            {(project.members ?? []).map((member) => (
              <option key={relationId(member.user)} value={relationId(member.user)}>
                {member.name}
              </option>
            ))}
          </select>
          <select className={fieldClass} name="milestone">
            <option value="">{copy.noMilestone}</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={fieldClass} name="dueDate" required type="date" />
          <select className={fieldClass} defaultValue="medium" name="priority">
            <option value="low">{copy.priorities[0]}</option>
            <option value="medium">{copy.priorities[1]}</option>
            <option value="high">{copy.priorities[2]}</option>
          </select>
        </div>
        <button
          className="h-11 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-sm font-semibold text-white"
          type="submit"
        >
          {copy.createTask}
        </button>
      </form>
    </details>
  )
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const locale = await getLocale()
  const t = getTranslations(locale)
  const statusLabel: Record<Task['status'], string> = t.project.status
  const user = await appAuth.currentUser()
  if (!user) notFound()

  const payload = await getPayloadClient()
  const projectResult = await payload.find({
    collection: 'projects',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    user,
    where: { id: { equals: id } },
  })
  const project = projectResult.docs[0]
  if (!project) notFound()

  const [milestoneResult, taskResult, checkInResult] = await Promise.all([
    payload.find({
      collection: 'milestones',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      sort: 'dueDate',
      user,
      where: { project: { equals: project.id } },
    }),
    payload.find({
      collection: 'tasks',
      depth: 0,
      limit: 300,
      overrideAccess: false,
      sort: 'dueDate',
      user,
      where: { project: { equals: project.id } },
    }),
    payload.find({
      collection: 'check-ins',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      sort: '-weekOf',
      user,
      where: { project: { equals: project.id } },
    }),
  ])

  const milestones = milestoneResult.docs
  const tasks = taskResult.docs
  const checkIns = checkInResult.docs
  const members = project.members ?? []
  const completeTasks = tasks.filter((task) => task.status === 'done').length
  const progress = tasks.length === 0 ? 0 : Math.round((completeTasks / tasks.length) * 100)
  const nextMilestone = milestones.find((milestone) => milestone.status !== 'complete')

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080914] text-[#f8f8ff]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-48 -top-48 size-[34rem] rounded-full bg-[#6d5dfc]/25 blur-[130px]" />
        <div className="absolute -right-56 top-[28%] size-[38rem] rounded-full bg-[#d946ef]/14 blur-[150px]" />
        <div className="absolute bottom-[-20rem] left-[32%] size-[34rem] rounded-full bg-[#06b6d4]/12 blur-[140px]" />
      </div>
      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[250px_1fr]">
        <aside className="border-r border-white/8 bg-white/[0.035] px-5 py-6 backdrop-blur-2xl lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center justify-between gap-3">
            <Link className="flex items-center gap-3" href="/">
              <Image
                alt="G-Lab"
                className="size-9 object-contain drop-shadow-[0_0_18px_rgba(124,109,255,0.42)]"
                height={36}
                priority
                src="/g-lab-mark.png"
                width={36}
              />
              <span className="font-semibold tracking-[-0.03em]">G-Lab</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={locale} returnTo={`/projects/${project.id}`} />
              <Link
                aria-label={t.common.backToProjects}
                className="grid size-8 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
                href="/"
              >
                <ArrowLeft className="size-4" />
              </Link>
            </div>
          </div>

          <div className="mt-9 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <span
              className="size-10 shrink-0 rounded-xl"
              style={{ backgroundColor: project.coverColor || '#6668E8' }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{project.name}</span>
              <span className="block truncate text-xs text-white/40">{project.course}</span>
            </span>
          </div>

          <nav className="mt-7 grid gap-1 text-sm">
            {[
              [LayoutDashboard, t.project.nav[0], '#overview'],
              [ListTodo, t.project.nav[1], '#tasks'],
              [MilestoneIcon, t.project.nav[2], '#milestones'],
              [Users, t.project.nav[3], '#team'],
              [ClipboardCheck, t.project.nav[4], '#check-ins'],
            ].map(([Icon, label, href], index) => (
              <a
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                  index === 0
                    ? 'border border-white/10 bg-white/10 text-white shadow-sm'
                    : 'text-white/45 hover:bg-white/[0.06] hover:text-white'
                }`}
                href={String(href)}
                key={String(label)}
              >
                <Icon className="size-4" />
                {String(label)}
              </a>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 p-4 text-white shadow-[0_20px_60px_rgba(79,70,229,0.12)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              {t.project.roomCode}
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tracking-[0.15em]">
              {project.roomCode}
            </p>
            <p className="mt-2 text-xs leading-5 text-white/55">
              {t.project.roomCodeCopy}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {user.displayName}
              </span>
              <span className="block truncate text-[10px] text-white/35">
                {user.email.endsWith('@guest.g-lab.local')
                  ? t.common.secureAccountOnHome
                  : user.email}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-white/55 hover:bg-white/10 hover:text-white"
                type="submit"
              >
                {t.common.signOut}
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-[#080914]/65 px-5 py-5 backdrop-blur-2xl sm:px-8 lg:px-10">
            <div>
              <p className="text-xs font-medium text-white/40">
                {project.course} · {members.length} {t.project.members}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                {project.name}
              </h1>
            </div>
            <div className="relative">
              <AddTask copy={t.project} milestones={milestones} project={project} />
            </div>
          </header>

          <div className="grid gap-6 p-5 sm:p-8 lg:p-10">
            {error && (
              <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
            <section className="scroll-mt-6" id="overview">
              <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                <article className="overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/20 via-white/[0.055] to-cyan-400/10 p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
                        {t.project.projectGoal}
                      </p>
                      <h2 className="mt-5 max-w-2xl text-2xl font-medium leading-snug tracking-[-0.03em] sm:text-3xl">
                        {project.goal}
                      </h2>
                    </div>
                    <Target className="size-6 shrink-0 text-violet-300" />
                  </div>
                  {project.description && (
                    <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-9">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-white/55">{t.project.overallProgress}</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 shadow-[0_0_16px_rgba(167,139,250,0.55)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </article>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <article className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-2xl">
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
                        <CalendarDays className="size-5" />
                      </span>
                    </div>
                    <div className="mt-5">
                      <DeadlineCountdown copy={t.project} dueDate={project.dueDate} locale={locale} />
                    </div>
                  </article>
                  <article className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-2xl">
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-2xl bg-violet-400/10 text-violet-300">
                        <Flag className="size-5" />
                      </span>
                      <span className="text-xs text-white/35">
                        {nextMilestone
                          ? formatDate(nextMilestone.dueDate, locale)
                          : t.project.notSet}
                      </span>
                    </div>
                    <p className="mt-5 truncate text-lg font-semibold">
                      {nextMilestone?.title || t.project.firstMilestone}
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                      {t.project.nextCheckpoint}
                    </p>
                  </article>
                </div>
              </div>
            </section>

            <section className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl sm:p-6" id="tasks">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                    {t.project.responsibilities}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                    {t.project.taskBoard}
                  </h2>
                </div>
                <p className="text-sm text-white/40">
                  {completeTasks} / {tasks.length} {t.project.complete}
                </p>
              </div>

              {tasks.length === 0 ? (
                <div className="mt-6 grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/15 p-8 text-center">
                  <div>
                    <Sparkles className="mx-auto size-6 text-violet-300" />
                    <p className="mt-3 font-semibold">{t.project.emptyTasksTitle}</p>
                    <p className="mt-1 text-sm text-white/40">
                      {t.project.emptyTasksCopy}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {tasks.map((task) => (
                    <article className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-white/20 hover:bg-white/[0.045]" key={task.id}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[task.status]}`}>
                          {statusLabel[task.status]}
                        </span>
                        <span
                          className={`size-2 rounded-full ${
                            task.priority === 'high'
                              ? 'bg-red-400'
                              : task.priority === 'medium'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <h3 className="mt-4 font-semibold leading-5">{task.title}</h3>
                      {task.description && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/40">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-3 text-xs">
                        <span className="flex items-center gap-2 text-white/55">
                          <span className="grid size-6 place-items-center rounded-full bg-violet-400/15 text-[9px] font-bold text-violet-200">
                            {initials(task.assigneeName || t.project.unassigned)}
                          </span>
                          {task.assigneeName}
                        </span>
                        <span className="flex items-center gap-1 text-white/35">
                          <Clock3 className="size-3" />
                          {formatDate(task.dueDate, locale)}
                        </span>
                      </div>
                      <form action={updateTaskStatusAction} className="mt-3 flex gap-2">
                        <input name="projectId" type="hidden" value={project.id} />
                        <input name="taskId" type="hidden" value={task.id} />
                        <select
                          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white"
                          defaultValue={task.status}
                          name="status"
                        >
                          {Object.entries(statusLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label={t.project.updateTaskStatus}
                          className="grid size-8 place-items-center rounded-lg bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                          type="submit"
                        >
                          <Check className="size-3.5" />
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <section
                className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl sm:p-6"
                id="milestones"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                      {t.project.projectPath}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                      {t.project.milestones}
                    </h2>
                  </div>
                  <MilestoneIcon className="size-5 text-violet-300" />
                </div>
                <div className="mt-6 grid gap-1">
                  {milestones.length === 0 ? (
                    <p className="rounded-2xl border border-white/8 bg-black/15 p-5 text-sm text-white/40">
                      {t.project.emptyMilestones}
                    </p>
                  ) : (
                    milestones.map((milestone, index) => (
                      <div className="relative flex gap-4 pb-5" key={milestone.id}>
                        {index < milestones.length - 1 && (
                          <span className="absolute left-[15px] top-7 h-full w-px bg-white/10" />
                        )}
                        <div className="relative z-10 shrink-0">
                          <MilestoneStatusButton
                            complete={milestone.status === 'complete'}
                            completeLabel={t.project.markMilestoneComplete}
                            milestoneId={milestone.id}
                            projectId={project.id}
                            reopenLabel={t.project.reopenMilestone}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{milestone.title}</p>
                          <p className="mt-1 text-xs text-white/35">
                            {formatDate(milestone.dueDate, locale)}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 size-4 text-white/25" />
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 border-t border-white/8 pt-4">
                  <AddMilestoneForm copy={t.project} projectId={project.id} />
                </div>
              </section>

              <section
                className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl sm:p-6"
                id="team"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                      {t.project.contributionHistory}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                      {t.project.teamBalance}
                    </h2>
                  </div>
                  <Users className="size-5 text-cyan-300" />
                </div>
                <div className="mt-6 grid gap-3">
                  {members.map((member, index) => {
                    const memberId = relationId(member.user)
                    const assigned = tasks.filter(
                      (task) => relationId(task.assignee) === memberId,
                    )
                    const done = assigned.filter((task) => task.status === 'done').length
                    const checkInCount = checkIns.filter(
                      (checkIn) => relationId(checkIn.member) === memberId,
                    ).length
                    return (
                      <div
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-3.5"
                        key={`${memberId}-${index}`}
                      >
                        <span className="grid size-10 place-items-center rounded-full bg-violet-400/15 text-xs font-bold text-violet-200">
                          {initials(member.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{member.name}</p>
                            {member.role === 'owner' && (
                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase text-white/45">
                                {t.project.owner}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-white/35">
                            {done}/{assigned.length} {t.project.tasks} · {checkInCount}{' '}
                            {t.project.checkIns}
                          </p>
                        </div>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
                            style={{
                              width: `${assigned.length ? (done / assigned.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/35">
                  {t.project.balanceNote}
                </p>
              </section>
            </div>

            <section
              className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl sm:p-6"
              id="check-ins"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                    {t.project.weeklyRhythm}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                    {t.project.teamCheckIns}
                  </h2>
                </div>
                <AddCheckInForm copy={t.project} projectId={project.id} />
              </div>
              {checkIns.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/8 bg-black/15 p-6 text-center">
                  <ClipboardCheck className="mx-auto size-6 text-violet-300" />
                  <p className="mt-3 font-semibold">{t.project.noCheckIns}</p>
                  <p className="mt-1 text-sm text-white/40">
                    {t.project.noCheckInsCopy}
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 lg:grid-cols-2">
                  {checkIns.slice(0, 6).map((checkIn) => (
                    <article className="rounded-2xl border border-white/10 bg-black/10 p-4" key={checkIn.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-full bg-cyan-300/15 text-[10px] font-bold text-cyan-200">
                            {initials(checkIn.memberName || t.project.memberFallback)}
                          </span>
                          <p className="text-sm font-semibold">{checkIn.memberName}</p>
                        </div>
                        <span className="text-xs text-white/35">
                          {formatDate(checkIn.weekOf, locale)}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                            {t.project.completed}
                          </p>
                          <p className="mt-1 leading-5 text-white/60">{checkIn.completed}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                            {t.project.next}
                          </p>
                          <p className="mt-1 leading-5 text-white/60">{checkIn.next}</p>
                        </div>
                        {checkIn.blockers && (
                          <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                              {t.project.blocker}
                            </p>
                            <p className="mt-1 leading-5 text-amber-100/70">{checkIn.blockers}</p>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
