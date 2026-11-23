'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { appAuth } from '@/lib/app-auth'
import type { Locale } from '@/lib/i18n'
import { getLocale, localeCookieName } from '@/lib/locale'
import { getPayloadClient } from '@/lib/payload'

export type ActionState = {
  error?: string
}

const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function field(formData: FormData, name: string, maxLength: number): string {
  const value = String(formData.get(name) || '').trim()
  if (!value || value.length > maxLength) throw new Error(`Please check ${name}.`)
  return value
}

function optionalField(formData: FormData, name: string, maxLength: number): string {
  const value = String(formData.get(name) || '').trim()
  if (value.length > maxLength) throw new Error(`Please check ${name}.`)
  return value
}

function dateField(formData: FormData, name: string): string {
  const value = field(formData, name, 10)
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date.')
  return date.toISOString()
}

function choice<T extends string>(
  formData: FormData,
  name: string,
  allowed: readonly T[],
): T {
  const value = String(formData.get(name) || '')
  if (!allowed.includes(value as T)) throw new Error(`Please check ${name}.`)
  return value as T
}

function colorField(formData: FormData): string {
  const value = String(formData.get('coverColor') || '#5B5CE2')
  if (!/^#[0-9A-F]{6}$/i.test(value)) throw new Error('Choose a valid cover color.')
  return value
}

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return String(value || '')
}

function createRoomCode(): string {
  const bytes = randomBytes(7)
  return Array.from(bytes, (byte) => roomAlphabet[byte % roomAlphabet.length]).join('')
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

const indonesianErrors: Record<string, string> = {
  'Choose a valid date.': 'Pilih tanggal yang valid.',
  'Choose a valid cover color.': 'Pilih warna sampul yang valid.',
  'Enter a valid email address.': 'Masukkan alamat email yang valid.',
  'Use a password with at least 8 characters.':
    'Gunakan kata sandi dengan minimal 8 karakter.',
  'The passwords do not match.': 'Kata sandi tidak cocok.',
  'Email or password is incorrect.': 'Email atau kata sandi salah.',
  'Create or secure your account before continuing.':
    'Buat atau amankan akun Anda sebelum melanjutkan.',
  'Enter the seven-character room code.': 'Masukkan kode ruang tujuh karakter.',
  'That room code was not found.': 'Kode ruang tersebut tidak ditemukan.',
  'Rejoin the project to continue.': 'Bergabung kembali ke proyek untuk melanjutkan.',
  'Something went wrong. Please try again.': 'Terjadi kesalahan. Silakan coba lagi.',
  'That email may already be in use. Try signing in instead.':
    'Email tersebut mungkin sudah digunakan. Coba masuk.',
}

async function localizedMessage(error: unknown): Promise<string> {
  const detail = message(error)
  if ((await getLocale()) === 'en') return detail
  if (detail.startsWith('Please check ')) {
    return 'Periksa kembali data yang dimasukkan.'
  }
  return indonesianErrors[detail] ?? detail
}

export async function setLocaleAction(formData: FormData) {
  const locale: Locale = formData.get('locale') === 'id' ? 'id' : 'en'
  const requestedPath = String(formData.get('returnTo') || '/')
  const returnTo =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/'

  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  redirect(returnTo)
}

function emailField(formData: FormData): string {
  const value = field(formData, 'email', 180).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Enter a valid email address.')
  }
  return value
}

function passwordFields(formData: FormData): string {
  const password = String(formData.get('password') || '')
  const confirmation = String(formData.get('confirmPassword') || '')
  if (password.length < 8 || password.length > 128) {
    throw new Error('Use a password with at least 8 characters.')
  }
  if (confirmation && password !== confirmation) {
    throw new Error('The passwords do not match.')
  }
  return password
}

function rethrowRedirect(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'digest' in error &&
    String(error.digest).startsWith('NEXT_REDIRECT')
  ) {
    throw error
  }
}

export async function signUpAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await appAuth.signUp({
      displayName: field(formData, 'displayName', 40),
      email: emailField(formData),
      password: passwordFields(formData),
    })
    redirect('/')
  } catch (error) {
    rethrowRedirect(error)
    const detail = message(error)
    const translatedDetail = await localizedMessage(error)
    return {
      error: detail.toLowerCase().includes('email')
        ? await localizedMessage(
            new Error('That email may already be in use. Try signing in instead.'),
          )
        : translatedDetail,
    }
  }
}

export async function loginAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await appAuth.login({
      email: emailField(formData),
      password: String(formData.get('password') || ''),
    })
    redirect('/')
  } catch (error) {
    rethrowRedirect(error)
    return { error: await localizedMessage(new Error('Email or password is incorrect.')) }
  }
}

export async function claimAccountAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await appAuth.claimAccount({
      displayName: field(formData, 'displayName', 40),
      email: emailField(formData),
      password: passwordFields(formData),
    })
    redirect('/')
  } catch (error) {
    rethrowRedirect(error)
    return { error: await localizedMessage(error) }
  }
}

export async function logoutAction() {
  await appAuth.logout()
  redirect('/')
}

async function requireAccountUser() {
  const user = await appAuth.currentUser()
  if (!user || user.email.endsWith('@guest.g-lab.local')) {
    throw new Error('Create or secure your account before continuing.')
  }
  return user
}

export async function createProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireAccountUser()
    const payload = await getPayloadClient()
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: field(formData, 'name', 100),
        description: optionalField(formData, 'description', 600),
        course: field(formData, 'course', 100),
        dueDate: dateField(formData, 'dueDate'),
        goal: field(formData, 'goal', 500),
        coverColor: colorField(formData),
        roomCode: createRoomCode(),
      },
      overrideAccess: false,
      user,
    })

    redirect(`/projects/${project.id}`)
  } catch (error) {
    rethrowRedirect(error)
    return { error: await localizedMessage(error) }
  }
}

export async function joinProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const roomCode = field(formData, 'roomCode', 12).toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{7}$/.test(roomCode)) {
      return {
        error: await localizedMessage(new Error('Enter the seven-character room code.')),
      }
    }
    const user = await requireAccountUser()
    const payload = await getPayloadClient()

    // The room code is a capability: only this exact-match lookup bypasses normal
    // member access, and no project data is returned until membership is added.
    const result = await payload.find({
      collection: 'projects',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { roomCode: { equals: roomCode } },
    })
    const project = result.docs[0]
    if (!project) {
      return { error: await localizedMessage(new Error('That room code was not found.')) }
    }

    const members = project.members ?? []
    const alreadyJoined = members.some(
      (member) => relationId(member.user) === String(user.id),
    )
    if (!alreadyJoined) {
      await payload.update({
        collection: 'projects',
        id: project.id,
        data: {
          members: [
            ...members.map((member) => ({
              name: member.name,
              role: member.role,
              user: relationId(member.user),
            })),
            { name: user.displayName, role: 'member', user: user.id },
          ],
        },
        overrideAccess: true,
      })
    }

    redirect(`/projects/${project.id}`)
  } catch (error) {
    rethrowRedirect(error)
    return { error: await localizedMessage(error) }
  }
}

async function requireProjectMember(projectId: string) {
  const user = await appAuth.currentUser()
  if (!user) throw new Error('Rejoin the project to continue.')

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'projects',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    user,
    where: { id: { equals: projectId } },
  })
  if (!result.docs[0]) throw new Error('Rejoin the project to continue.')
  return { payload, user }
}

export async function createMilestoneAction(formData: FormData) {
  let projectId = ''
  try {
    projectId = field(formData, 'projectId', 100)
    const { payload, user } = await requireProjectMember(projectId)
    await payload.create({
      collection: 'milestones',
      data: {
        project: projectId,
        title: field(formData, 'title', 120),
        dueDate: dateField(formData, 'dueDate'),
        status: 'upcoming',
      },
      overrideAccess: false,
      user,
    })
    refresh()
  } catch (error) {
    redirect(
      projectId
        ? `/projects/${projectId}?error=${encodeURIComponent(await localizedMessage(error))}`
        : '/',
    )
  }
}

export async function createTaskAction(formData: FormData) {
  let projectId = ''
  try {
    projectId = field(formData, 'projectId', 100)
    const { payload, user } = await requireProjectMember(projectId)
    await payload.create({
      collection: 'tasks',
      data: {
        project: projectId,
        milestone: optionalField(formData, 'milestone', 100) || undefined,
        assignee: field(formData, 'assignee', 100),
        title: field(formData, 'title', 160),
        description: optionalField(formData, 'description', 800),
        dueDate: dateField(formData, 'dueDate'),
        priority: choice(formData, 'priority', ['low', 'medium', 'high'] as const),
        status: 'todo',
      },
      overrideAccess: false,
      user,
    })
    refresh()
  } catch (error) {
    redirect(
      projectId
        ? `/projects/${projectId}?error=${encodeURIComponent(await localizedMessage(error))}`
        : '/',
    )
  }
}

export async function updateMilestoneStatusAction(formData: FormData) {
  let projectId = ''
  try {
    projectId = field(formData, 'projectId', 100)
    const milestoneId = field(formData, 'milestoneId', 100)
    const status = choice(formData, 'status', ['upcoming', 'complete'] as const)
    const { payload, user } = await requireProjectMember(projectId)
    await payload.update({
      collection: 'milestones',
      id: milestoneId,
      data: { status },
      overrideAccess: false,
      user,
    })
    refresh()
  } catch (error) {
    redirect(
      projectId
        ? `/projects/${projectId}?error=${encodeURIComponent(await localizedMessage(error))}`
        : '/',
    )
  }
}

export async function updateTaskStatusAction(formData: FormData) {
  let projectId = ''
  try {
    projectId = field(formData, 'projectId', 100)
    const taskId = field(formData, 'taskId', 100)
    const status = choice(formData, 'status', [
      'todo',
      'in-progress',
      'review',
      'done',
    ] as const)
    const { payload, user } = await requireProjectMember(projectId)
    await payload.update({
      collection: 'tasks',
      id: taskId,
      data: { status },
      overrideAccess: false,
      user,
    })
    refresh()
  } catch (error) {
    redirect(
      projectId
        ? `/projects/${projectId}?error=${encodeURIComponent(await localizedMessage(error))}`
        : '/',
    )
  }
}

export async function createCheckInAction(formData: FormData) {
  let projectId = ''
  try {
    projectId = field(formData, 'projectId', 100)
    const { payload, user } = await requireProjectMember(projectId)
    await payload.create({
      collection: 'check-ins',
      data: {
        project: projectId,
        weekOf: dateField(formData, 'weekOf'),
        completed: field(formData, 'completed', 600),
        next: field(formData, 'next', 600),
        blockers: optionalField(formData, 'blockers', 600),
      },
      overrideAccess: false,
      user,
    })
    refresh()
  } catch (error) {
    redirect(
      projectId
        ? `/projects/${projectId}?error=${encodeURIComponent(await localizedMessage(error))}`
        : '/',
    )
  }
}
