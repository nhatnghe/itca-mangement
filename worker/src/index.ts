export interface Env { DB: D1Database; ALLOWED_ORIGIN: string; BOOTSTRAP_SECRET?: string }
type User = { id:number; username:string; full_name:string; role_code:string; department_id:number|null }
const TYPES = new Set([
  'LATE',
  'EARLY_LEAVE',
  'MORNING_LEAVE',
  'AFTERNOON_LEAVE',
  'FULL_DAY_LEAVE',
  'REMOTE',
  'MAKEUP_LEAVE'
])
const enc=new TextEncoder()
function cors(req: Request, env: Env) {
  const origin = req.headers.get('Origin') || ''

  const allowedOrigins = [
    env.ALLOWED_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]

  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : env.ALLOWED_ORIGIN

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type,X-Bootstrap-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Vary': 'Origin',
  }
}
function json(data:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}})}
function hex(b:ArrayBuffer){return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function bytesHex(b:Uint8Array){return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function sha(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
function randomHex(n=32){const b=new Uint8Array(n);crypto.getRandomValues(b);return bytesHex(b)}
function cookie(token:string){return `itca_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=28800`}
function clearCookie(){return 'itca_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'}
function tokenFrom(req:Request){return (req.headers.get('Cookie')||'').match(/(?:^|;\s*)itca_session=([^;]+)/)?.[1]||null}
async function currentUser(req:Request,env:Env){const t=tokenFrom(req);if(!t)return null;const th=await sha(t);return env.DB.prepare(`SELECT u.id,u.username,u.full_name,r.code role_code,u.department_id FROM SESSIONS s JOIN USERS u ON u.id=s.user_id JOIN ROLES r ON r.id=u.role_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).bind(th).first<User>()}
function manager(u:User){return u.role_code==='ADMIN'||u.role_code==='TRUONG_PHONG'}
type WorkCalendarConfig = {
  morning_start: string
  morning_end: string
  afternoon_start: string
  afternoon_end: string
  weekdays: number[]
}

function vietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short'
  }).formatToParts(date)

  const get = (type: string) =>
    parts.find(p => p.type === type)?.value || ''

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  }

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
    weekday: weekdayMap[get('weekday')]
  }
}

async function getWorkCalendar(
  env: Env
): Promise<WorkCalendarConfig> {
  const rows = await env.DB.prepare(`
    SELECT setting_key, setting_value
    FROM SYSTEM_SETTINGS
    WHERE setting_key IN (
      'work_morning_start',
      'work_morning_end',
      'work_afternoon_start',
      'work_afternoon_end',
      'work_weekdays'
    )
  `).all()

  const values: Record<string, string> = {}

  for (const row of rows.results as any[]) {
    values[row.setting_key] = row.setting_value
  }

  let weekdays: number[] = [1, 2, 3, 4, 5]

  try {
    const parsed = JSON.parse(
      values.work_weekdays || '[1,2,3,4,5]'
    )

    if (Array.isArray(parsed)) {
      weekdays = parsed
        .map(Number)
        .filter(
          day =>
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6
        )
    }
  } catch {
    weekdays = [1, 2, 3, 4, 5]
  }

  return {
    morning_start:
      values.work_morning_start || '08:00',
    morning_end:
      values.work_morning_end || '11:30',
    afternoon_start:
      values.work_afternoon_start || '13:00',
    afternoon_end:
      values.work_afternoon_end || '17:00',
    weekdays
  }
}

async function isWorkingDay(
  env: Env,
  date: string,
  config?: WorkCalendarConfig
): Promise<boolean> {
  const exception = await env.DB.prepare(`
    SELECT is_working
    FROM WORK_CALENDAR_DAYS
    WHERE work_date = ?
  `).bind(date).first<{ is_working: number }>()

  if (exception) {
    return Number(exception.is_working) === 1
  }

  const calendar = config || await getWorkCalendar(env)

  // Tạo giờ giữa trưa UTC để tránh lệch ngày khi xác định thứ.
  const parsed = new Date(`${date}T12:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return calendar.weekdays.includes(parsed.getUTCDay())
}

async function getWorkingDatesInRange(
  env: Env,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const start = new Date(`${startDate}T12:00:00Z`)
  const end = new Date(`${endDate}T12:00:00Z`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return []
  }

  const config = await getWorkCalendar(env)
  const result: string[] = []

  const current = new Date(start)

  while (current <= end) {
    const date = current.toISOString().slice(0, 10)

    if (await isWorkingDay(env, date, config)) {
      result.push(date)
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return result
}

function getDefaultRealtimeStatus(
  time: string,
  config: WorkCalendarConfig
): string {
  const hhmm = time.slice(0, 5)

  if (
    hhmm >= config.morning_start &&
    hhmm < config.morning_end
  ) {
    return 'WORKING'
  }

  if (
    hhmm >= config.afternoon_start &&
    hhmm < config.afternoon_end
  ) {
    return 'WORKING'
  }

  return 'NORMAL'
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time
    .slice(0, 5)
    .split(':')
    .map(Number)

  return hour * 60 + minute
}

function isTimeInMinuteRange(
  currentTime: string,
  startMinute: number,
  endMinute: number
): boolean {
  const current = timeToMinutes(currentTime)

  return current >= startMinute && current < endMinute
}
export default {async fetch(req:Request,env:Env):Promise<Response>{const h=cors(req,env);if(req.method==='OPTIONS')return new Response(null,{headers:h});const url=new URL(req.url);try{
 if(url.pathname==='/api/health')return json({ok:true,service:'itca-mangement-api',version:'2.0'},200,h)
 if(url.pathname==='/api/auth/bootstrap'&&req.method==='POST'){if(!env.BOOTSTRAP_SECRET||req.headers.get('X-Bootstrap-Secret')!==env.BOOTSTRAP_SECRET)return json({message:'Forbidden'},403,h);const count=await env.DB.prepare('SELECT COUNT(*) n FROM USERS').first<{n:number}>();if((count?.n||0)>0)return json({message:'Hệ thống đã có người dùng'},409,h);const b=await req.json<{username:string;password:string;full_name:string}>();if(!b.username||!b.password||b.password.length<8)return json({message:'Thông tin bootstrap không hợp lệ'},400,h);const salt=randomHex(16),ph=await passwordHash(b.password,salt);await env.DB.prepare(`INSERT INTO DEPARTMENTS(code,name) VALUES('ITCA','ITCA') ON CONFLICT(code) DO NOTHING`).run();const role=await env.DB.prepare(`SELECT id FROM ROLES WHERE code='ADMIN'`).first<{id:number}>();const dep=await env.DB.prepare(`SELECT id FROM DEPARTMENTS WHERE code='ITCA'`).first<{id:number}>();await env.DB.prepare(`INSERT INTO USERS(username,password_hash,password_salt,full_name,department_id,role_id) VALUES(?,?,?,?,?,?)`).bind(b.username,ph,salt,b.full_name,dep!.id,role!.id).run();return json({ok:true},201,h)}
 if(url.pathname==='/api/auth/login'&&req.method==='POST'){const b=await req.json<{username?:string;password?:string}>();const row=await env.DB.prepare(`SELECT u.id,u.username,u.full_name,u.password_hash,u.password_salt,r.code role_code,u.department_id FROM USERS u JOIN ROLES r ON r.id=u.role_id WHERE u.username=? AND u.active=1`).bind((b.username||'').trim()).first<any>();if(!row||!row.password_salt||await passwordHash(b.password||'',row.password_salt)!==row.password_hash)return json({message:'Tên đăng nhập hoặc mật khẩu không đúng'},401,h);const token=randomHex(),th=await sha(token);await env.DB.prepare(`INSERT INTO SESSIONS(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+8 hours'))`).bind(th,row.id).run();delete row.password_hash;delete row.password_salt;return json({user:row},200,{...h,'Set-Cookie':cookie(token)})}
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){const t=tokenFrom(req);if(t)await env.DB.prepare('DELETE FROM SESSIONS WHERE token_hash=?').bind(await sha(t)).run();return json({ok:true},200,{...h,'Set-Cookie':clearCookie()})}
 const u=await currentUser(req,env);if(!u)return json({message:'Unauthorized'},401,h)
 if (url.pathname === '/api/notifications/summary' && req.method === 'GET') {
  if (!manager(u)) {
    return json({
      pending_approvals: 0
    }, 200, h)
  }

  let row

  if (u.role_code === 'TRUONG_PHONG' && u.department_id) {
    row = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM LEAVE_REQUESTS lr
      JOIN USERS us ON us.id = lr.user_id
      WHERE lr.status = 'PENDING'
        AND us.active = 1
        AND us.department_id = ?
    `).bind(u.department_id).first<{ count: number }>()
  } else {
    row = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM LEAVE_REQUESTS lr
      JOIN USERS us ON us.id = lr.user_id
      WHERE lr.status = 'PENDING'
        AND us.active = 1
    `).first<{ count: number }>()
  }

  return json({
    pending_approvals: Number(row?.count || 0)
  }, 200, h)
}
 if(url.pathname==='/api/auth/me')return json({user:u},200,h)
// ==================== ADMIN: USER MANAGEMENT ====================

// Danh sách role và phòng ban cho form quản trị
if (url.pathname === '/api/admin/user-options' && req.method === 'GET') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const [roles, departments] = await Promise.all([
    env.DB.prepare(`
      SELECT id, code, name
      FROM ROLES
      ORDER BY id
    `).all(),

    env.DB.prepare(`
      SELECT id, code, name
      FROM DEPARTMENTS
      WHERE active = 1
      ORDER BY name
    `).all()
  ])

  return json({
    roles: roles.results,
    departments: departments.results
  }, 200, h)
}

// ======================================================
// ADMIN - SYSTEM SETTINGS
// ======================================================

if (url.pathname === '/api/admin/settings' && req.method === 'GET') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Bạn không có quyền truy cập' }, 403, h)
  }

  const rows = await env.DB.prepare(`
    SELECT
      setting_key,
      setting_value,
      description,
      updated_at
    FROM SYSTEM_SETTINGS
    WHERE setting_key LIKE 'approval_%'
    ORDER BY setting_key
  `).all()

  return json({
    items: rows.results
  }, 200, h)
}

if (url.pathname === '/api/admin/settings' && req.method === 'PUT') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Bạn không có quyền thay đổi cấu hình' }, 403, h)
  }

  const body = await req.json<any>()

  const allowedKeys = new Set([
    'approval_LATE',
    'approval_EARLY_LEAVE',
    'approval_MORNING_LEAVE',
    'approval_AFTERNOON_LEAVE',
    'approval_FULL_DAY_LEAVE',
    'approval_ANNUAL_LEAVE',
    'approval_REMOTE',
  ])

  if (!allowedKeys.has(body.setting_key)) {
    return json({
      message: 'Cấu hình không hợp lệ'
    }, 400, h)
  }

  const value =
    body.setting_value === true ||
    body.setting_value === 1 ||
    body.setting_value === '1'
      ? '1'
      : '0'

  await env.DB.prepare(`
    UPDATE SYSTEM_SETTINGS
    SET
      setting_value = ?,
      updated_at = datetime('now')
    WHERE setting_key = ?
  `).bind(
    value,
    body.setting_key
  ).run()

  return json({
    success: true,
    setting_key: body.setting_key,
    setting_value: value
  }, 200, h)
}

// ======================================================
// ADMIN - WORK CALENDAR
// ======================================================
if (
  url.pathname === '/api/work-calendar' &&
  req.method === 'GET'
) {
  const config = await getWorkCalendar(env)

  return json({
    morning_start: config.morning_start,
    morning_end: config.morning_end,
    afternoon_start: config.afternoon_start,
    afternoon_end: config.afternoon_end,
    weekdays: config.weekdays
  }, 200, h)
}
if (
  url.pathname === '/api/admin/work-calendar' &&
  req.method === 'GET'
) {
  if (u.role_code !== 'ADMIN') {
    return json(
      { message: 'Bạn không có quyền truy cập' },
      403,
      h
    )
  }

  const settings = await env.DB.prepare(`
    SELECT setting_key, setting_value
    FROM SYSTEM_SETTINGS
    WHERE setting_key IN (
      'work_morning_start',
      'work_morning_end',
      'work_afternoon_start',
      'work_afternoon_end',
      'work_weekdays'
    )
  `).all()

  const days = await env.DB.prepare(`
    SELECT
      id,
      work_date,
      is_working,
      name,
      created_at,
      updated_at
    FROM WORK_CALENDAR_DAYS
    ORDER BY work_date DESC
  `).all()

  const values: Record<string, string> = {}

  for (const row of settings.results as any[]) {
    values[row.setting_key] = row.setting_value
  }

  let weekdays: number[] = [1, 2, 3, 4, 5]

  try {
    const parsed = JSON.parse(
      values.work_weekdays || '[1,2,3,4,5]'
    )

    if (Array.isArray(parsed)) {
      weekdays = parsed.map(Number)
    }
  } catch {
    weekdays = [1, 2, 3, 4, 5]
  }

  return json({
    settings: {
      morning_start:
        values.work_morning_start || '08:00',

      morning_end:
        values.work_morning_end || '11:30',

      afternoon_start:
        values.work_afternoon_start || '13:00',

      afternoon_end:
        values.work_afternoon_end || '17:00',

      weekdays
    },

    days: days.results
  }, 200, h)
}


if (
  url.pathname === '/api/admin/work-calendar' &&
  req.method === 'PUT'
) {
  if (u.role_code !== 'ADMIN') {
    return json(
      { message: 'Bạn không có quyền thay đổi cấu hình' },
      403,
      h
    )
  }

  const body = await req.json<any>()

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

  const morningStart = String(body.morning_start || '')
  const morningEnd = String(body.morning_end || '')
  const afternoonStart = String(body.afternoon_start || '')
  const afternoonEnd = String(body.afternoon_end || '')

  if (
    !timePattern.test(morningStart) ||
    !timePattern.test(morningEnd) ||
    !timePattern.test(afternoonStart) ||
    !timePattern.test(afternoonEnd)
  ) {
    return json(
      { message: 'Giờ làm việc không hợp lệ' },
      400,
      h
    )
  }

  if (
    morningStart >= morningEnd ||
    morningEnd > afternoonStart ||
    afternoonStart >= afternoonEnd
  ) {
    return json(
      {
        message:
          'Khung giờ làm việc không hợp lệ. Vui lòng kiểm tra giờ sáng, giờ nghỉ trưa và giờ chiều.'
      },
      400,
      h
    )
  }

  if (
    !Array.isArray(body.weekdays) ||
    body.weekdays.length === 0
  ) {
    return json(
      { message: 'Phải chọn ít nhất một ngày làm việc trong tuần' },
      400,
      h
    )
  }

const weekdays: number[] = [
  ...new Set<number>(
    body.weekdays.map((x: any) => Number(x))
  )
].sort((a: number, b: number) => a - b)

  if (
    weekdays.some(
      day =>
        !Number.isInteger(day) ||
        day < 0 ||
        day > 6
    )
  ) {
    return json(
      { message: 'Ngày làm việc trong tuần không hợp lệ' },
      400,
      h
    )
  }

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE SYSTEM_SETTINGS
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'work_morning_start'
    `).bind(morningStart),

    env.DB.prepare(`
      UPDATE SYSTEM_SETTINGS
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'work_morning_end'
    `).bind(morningEnd),

    env.DB.prepare(`
      UPDATE SYSTEM_SETTINGS
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'work_afternoon_start'
    `).bind(afternoonStart),

    env.DB.prepare(`
      UPDATE SYSTEM_SETTINGS
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'work_afternoon_end'
    `).bind(afternoonEnd),

    env.DB.prepare(`
      UPDATE SYSTEM_SETTINGS
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'work_weekdays'
    `).bind(JSON.stringify(weekdays))
  ])

  return json({
    success: true,
    message: 'Đã lưu cấu hình lịch làm việc'
  }, 200, h)
}


// ======================================================
// ADMIN - WORK CALENDAR EXCEPTION DAY
// ======================================================

if (
  url.pathname === '/api/admin/work-calendar/days' &&
  req.method === 'POST'
) {
  if (u.role_code !== 'ADMIN') {
    return json(
      { message: 'Bạn không có quyền thay đổi lịch làm việc' },
      403,
      h
    )
  }

  const body = await req.json<any>()

  const workDate = String(body.work_date || '')
  const name = String(body.name || '').trim()
  const isWorking = Number(body.is_working)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return json(
      { message: 'Ngày không hợp lệ' },
      400,
      h
    )
  }

  if (isWorking !== 0 && isWorking !== 1) {
    return json(
      { message: 'Loại ngày không hợp lệ' },
      400,
      h
    )
  }

  if (!name) {
    return json(
      {
        message:
          isWorking === 1
            ? 'Vui lòng nhập tên ngày làm việc đặc biệt'
            : 'Vui lòng nhập tên ngày nghỉ'
      },
      400,
      h
    )
  }

  await env.DB.prepare(`
    INSERT INTO WORK_CALENDAR_DAYS (
      work_date,
      is_working,
      name
    )
    VALUES (?, ?, ?)

    ON CONFLICT(work_date) DO UPDATE SET
      is_working = excluded.is_working,
      name = excluded.name,
      updated_at = datetime('now')
  `).bind(
    workDate,
    isWorking,
    name
  ).run()

  return json({
    success: true,
    message:
      isWorking === 1
        ? 'Đã lưu ngày làm việc đặc biệt'
        : 'Đã lưu ngày nghỉ theo QĐ'
  }, 200, h)
}


const deleteCalendarDayMatch =
  url.pathname.match(
    /^\/api\/admin\/work-calendar\/days\/(\d+)$/
  )

if (
  deleteCalendarDayMatch &&
  req.method === 'DELETE'
) {
  if (u.role_code !== 'ADMIN') {
    return json(
      { message: 'Bạn không có quyền thay đổi lịch làm việc' },
      403,
      h
    )
  }

  const id = Number(deleteCalendarDayMatch[1])

  const existing = await env.DB.prepare(`
    SELECT id
    FROM WORK_CALENDAR_DAYS
    WHERE id = ?
  `).bind(id).first()

  if (!existing) {
    return json(
      { message: 'Không tìm thấy ngày cấu hình' },
      404,
      h
    )
  }

  await env.DB.prepare(`
    DELETE FROM WORK_CALENDAR_DAYS
    WHERE id = ?
  `).bind(id).run()

  return json({
    success: true,
    message: 'Đã xóa ngày khỏi lịch đặc biệt'
  }, 200, h)
}
// Danh sách tất cả người dùng, kể cả tài khoản đã khóa
if (url.pathname === '/api/admin/users' && req.method === 'GET') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const r = await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.email,
      u.phone,
      u.department_id,
      d.code AS department_code,
      d.name AS department_name,
      u.role_id,
      ro.code AS role_code,
      ro.name AS role_name,
      u.active,
      u.created_at,
      u.updated_at
    FROM USERS u
    JOIN ROLES ro ON ro.id = u.role_id
    LEFT JOIN DEPARTMENTS d ON d.id = u.department_id
    ORDER BY u.full_name
  `).all()

  return json({ items: r.results }, 200, h)
}

// Thêm người dùng
if (url.pathname === '/api/admin/users' && req.method === 'POST') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const b = await req.json<{
    username?: string
    password?: string
    full_name?: string
    email?: string
    phone?: string
    department_id?: number | null
    role_id?: number
  }>()

  const username = (b.username || '').trim()
  const fullName = (b.full_name || '').trim()
  const password = b.password || ''

  if (!username || !fullName || password.length < 8 || !b.role_id) {
    return json({
      message: 'Tên đăng nhập, họ tên, vai trò và mật khẩu tối thiểu 8 ký tự là bắt buộc'
    }, 400, h)
  }

  const existing = await env.DB.prepare(`
    SELECT id FROM USERS WHERE username = ?
  `).bind(username).first()

  if (existing) {
    return json({ message: 'Tên đăng nhập đã tồn tại' }, 409, h)
  }

  const role = await env.DB.prepare(`
    SELECT id FROM ROLES WHERE id = ?
  `).bind(b.role_id).first()

  if (!role) {
    return json({ message: 'Vai trò không hợp lệ' }, 400, h)
  }

  if (b.department_id) {
    const dep = await env.DB.prepare(`
      SELECT id FROM DEPARTMENTS
      WHERE id = ? AND active = 1
    `).bind(b.department_id).first()

    if (!dep) {
      return json({ message: 'Phòng ban không hợp lệ' }, 400, h)
    }
  }

  const salt = randomHex(16)
  const ph = await passwordHash(password, salt)

  const result = await env.DB.prepare(`
    INSERT INTO USERS (
      username,
      password_hash,
      password_salt,
      full_name,
      email,
      phone,
      department_id,
      role_id,
      active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    username,
    ph,
    salt,
    fullName,
    b.email?.trim() || null,
    b.phone?.trim() || null,
    b.department_id || null,
    b.role_id
  ).run()

  return json({
    ok: true,
    id: result.meta.last_row_id
  }, 201, h)
}

// Sửa thông tin người dùng
const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/)

if (adminUserMatch && req.method === 'PUT') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const id = Number(adminUserMatch[1])

  const b = await req.json<{
    full_name?: string
    email?: string
    phone?: string
    department_id?: number | null
    role_id?: number
  }>()

  const fullName = (b.full_name || '').trim()

  if (!fullName || !b.role_id) {
    return json({ message: 'Họ tên và vai trò là bắt buộc' }, 400, h)
  }

  const target = await env.DB.prepare(`
    SELECT id FROM USERS WHERE id = ?
  `).bind(id).first()

  if (!target) {
    return json({ message: 'Không tìm thấy người dùng' }, 404, h)
  }

  const role = await env.DB.prepare(`
    SELECT id FROM ROLES WHERE id = ?
  `).bind(b.role_id).first()

  if (!role) {
    return json({ message: 'Vai trò không hợp lệ' }, 400, h)
  }

  if (b.department_id) {
    const dep = await env.DB.prepare(`
      SELECT id FROM DEPARTMENTS
      WHERE id = ? AND active = 1
    `).bind(b.department_id).first()

    if (!dep) {
      return json({ message: 'Phòng ban không hợp lệ' }, 400, h)
    }
  }

  await env.DB.prepare(`
    UPDATE USERS
    SET
      full_name = ?,
      email = ?,
      phone = ?,
      department_id = ?,
      role_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    fullName,
    b.email?.trim() || null,
    b.phone?.trim() || null,
    b.department_id || null,
    b.role_id,
    id
  ).run()

  return json({ ok: true }, 200, h)
}

// Khóa / mở tài khoản
const adminStatusMatch =
  url.pathname.match(/^\/api\/admin\/users\/(\d+)\/status$/)

if (adminStatusMatch && req.method === 'PUT') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const id = Number(adminStatusMatch[1])

  const b = await req.json<{
    active?: boolean
  }>()

  if (typeof b.active !== 'boolean') {
    return json({ message: 'Trạng thái không hợp lệ' }, 400, h)
  }

  if (id === u.id && !b.active) {
    return json({
      message: 'Không thể tự khóa tài khoản đang đăng nhập'
    }, 400, h)
  }

  const target = await env.DB.prepare(`
    SELECT id FROM USERS WHERE id = ?
  `).bind(id).first()

  if (!target) {
    return json({ message: 'Không tìm thấy người dùng' }, 404, h)
  }

  await env.DB.prepare(`
    UPDATE USERS
    SET active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(b.active ? 1 : 0, id).run()

  // Khóa user thì xóa toàn bộ session của user đó
  if (!b.active) {
    await env.DB.prepare(`
      DELETE FROM SESSIONS WHERE user_id = ?
    `).bind(id).run()
  }

  return json({ ok: true }, 200, h)
}

// ADMIN đặt lại mật khẩu
const adminPasswordMatch =
  url.pathname.match(/^\/api\/admin\/users\/(\d+)\/password$/)

if (adminPasswordMatch && req.method === 'PUT') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Forbidden' }, 403, h)
  }

  const id = Number(adminPasswordMatch[1])

  const b = await req.json<{
    password?: string
  }>()

  if (!b.password || b.password.length < 8) {
    return json({
      message: 'Mật khẩu phải có ít nhất 8 ký tự'
    }, 400, h)
  }

  const target = await env.DB.prepare(`
    SELECT id FROM USERS WHERE id = ?
  `).bind(id).first()

  if (!target) {
    return json({ message: 'Không tìm thấy người dùng' }, 404, h)
  }

  const salt = randomHex(16)
  const ph = await passwordHash(b.password, salt)

  await env.DB.prepare(`
    UPDATE USERS
    SET
      password_hash = ?,
      password_salt = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(ph, salt, id).run()

  // Buộc các phiên cũ đăng nhập lại
  await env.DB.prepare(`
    DELETE FROM SESSIONS WHERE user_id = ?
  `).bind(id).run()

  return json({ ok: true }, 200, h)
}

// ================== END ADMIN: USER MANAGEMENT ==================

 if(url.pathname==='/api/users'&&req.method==='GET'){const q=manager(u)?`SELECT u.id,u.full_name,u.username,r.code role_code,d.name department FROM USERS u JOIN ROLES r ON r.id=u.role_id LEFT JOIN DEPARTMENTS d ON d.id=u.department_id WHERE u.active=1 ORDER BY u.full_name`:`SELECT u.id,u.full_name,u.username,r.code role_code,d.name department FROM USERS u JOIN ROLES r ON r.id=u.role_id LEFT JOIN DEPARTMENTS d ON d.id=u.department_id WHERE u.id=${u.id}`;const r=await env.DB.prepare(q).all();return json({items:r.results},200,h)}
if (
  url.pathname === '/api/daily-work/today' &&
  req.method === 'PUT'
) {
  const b = await req.json<{
    work_content?: string
    work_mode?: string
  }>()

  if (!b.work_content?.trim()) {
    return json(
      { message: 'Nội dung công việc là bắt buộc' },
      400,
      h
    )
  }

  const vnNow = vietnamDateParts()
  const working = await isWorkingDay(env, vnNow.date)

  if (!working) {
    return json(
      {
        message:
          'Hôm nay là ngày nghỉ theo QĐ, không thể cập nhật công việc.'
      },
      400,
      h
    )
  }

  await env.DB.prepare(`
    INSERT INTO DAILY_WORK (
      user_id,
      work_date,
      work_content,
      work_mode
    )
    VALUES (?, ?, ?, ?)

    ON CONFLICT(user_id, work_date) DO UPDATE SET
      work_content = excluded.work_content,
      work_mode = excluded.work_mode,
      updated_at = datetime('now')
  `).bind(
    u.id,
    vnNow.date,
    b.work_content.trim(),
    b.work_mode || 'OFFICE'
  ).run()

  return json({
    ok: true,
    work_date: vnNow.date
  }, 200, h)
}
 
 // ================== DAILY WORK SEARCH ==================

if (url.pathname === '/api/daily-work' && req.method === 'GET') {
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const userId = url.searchParams.get('user_id')

  if (!from || !to) {
    return json({
      message: 'Từ ngày và đến ngày là bắt buộc'
    }, 400, h)
  }

  let sql = `
    SELECT
      dw.id,
      dw.user_id,
      us.full_name,
      us.username,
      d.name AS department,
      dw.work_date,
      dw.work_content,
      dw.work_mode,
      dw.updated_at
    FROM DAILY_WORK dw
    JOIN USERS us ON us.id = dw.user_id
    LEFT JOIN DEPARTMENTS d ON d.id = us.department_id
    WHERE dw.work_date BETWEEN ? AND ?
      AND us.active = 1
  `

  const params: any[] = [from, to]

  if (userId) {
    sql += ` AND dw.user_id = ?`
    params.push(Number(userId))
  }

  sql += ` ORDER BY dw.work_date DESC, us.full_name ASC`

  const rows = await env.DB.prepare(sql)
    .bind(...params)
    .all()

  return json({
    from,
    to,
    items: rows.results
  }, 200, h)
}


// ================== STATISTICS ==================

if (url.pathname === '/api/stats' && req.method === 'GET') {
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const userId = url.searchParams.get('user_id')

  if (!from || !to) {
    return json({
      message: 'Từ ngày và đến ngày là bắt buộc'
    }, 400, h)
  }

  let leaveSql = `
    SELECT
      lr.user_id,
      us.full_name,
      us.username,
      d.name AS department,
      lr.request_type,
      COUNT(*) AS count,
      COALESCE(SUM(lr.expected_minutes), 0) AS minutes
    FROM LEAVE_REQUESTS lr
    JOIN USERS us ON us.id = lr.user_id
    LEFT JOIN DEPARTMENTS d ON d.id = us.department_id
    WHERE lr.status = 'APPROVED'
      AND lr.start_date <= ?
      AND COALESCE(lr.end_date, lr.start_date) >= ?
      AND us.active = 1
  `

  const leaveParams: any[] = [to, from]

  if (userId) {
    leaveSql += ` AND lr.user_id = ?`
    leaveParams.push(Number(userId))
  }

  leaveSql += `
    GROUP BY
      lr.user_id,
      us.full_name,
      us.username,
      d.name,
      lr.request_type
    ORDER BY us.full_name, lr.request_type
  `

  const leaveRows = await env.DB.prepare(leaveSql)
    .bind(...leaveParams)
    .all()

  let workSql = `
    SELECT
      COUNT(*) AS work_days,
      COALESCE(
        SUM(CASE WHEN dw.work_mode = 'REMOTE' THEN 1 ELSE 0 END),
        0
      ) AS remote_days
    FROM DAILY_WORK dw
    JOIN USERS us ON us.id = dw.user_id
    WHERE dw.work_date BETWEEN ? AND ?
      AND us.active = 1
  `

  const workParams: any[] = [from, to]

  if (userId) {
    workSql += ` AND dw.user_id = ?`
    workParams.push(Number(userId))
  }

  const workSummary = await env.DB.prepare(workSql)
    .bind(...workParams)
    .first()

  return json({
    from,
    to,
    user_id: userId ? Number(userId) : null,
    work_days: Number((workSummary as any)?.work_days || 0),
    remote_days: Number((workSummary as any)?.remote_days || 0),
    items: leaveRows.results
  }, 200, h)
}


// ================== USERS FOR SEARCH ==================

if (url.pathname === '/api/search-users' && req.method === 'GET') {
  const rows = await env.DB.prepare(`
    SELECT
      us.id,
      us.full_name,
      us.username,
      d.name AS department
    FROM USERS us
    LEFT JOIN DEPARTMENTS d ON d.id = us.department_id
    WHERE us.active = 1
    ORDER BY us.full_name
  `).all()

  return json({
    items: rows.results
  }, 200, h)
}

if (
  url.pathname === '/api/dashboard/today' &&
  req.method === 'GET'
) {
  const vnNow = vietnamDateParts()
  const config = await getWorkCalendar(env)
  const workingToday = await isWorkingDay(
    env,
    vnNow.date,
    config
  )

  /*
   * Chỉ lấy thông tin user + DAILY_WORK ở đây.
   * Không JOIN trực tiếp LEAVE_REQUESTS để tránh một user
   * xuất hiện nhiều dòng khi có nhiều request trong cùng ngày.
   */
  const users = await env.DB.prepare(`
    SELECT
      us.id,
      us.full_name,
      r.code AS role_code,
      d.name AS department,
      w.work_content,
      w.work_mode
    FROM USERS us

    JOIN ROLES r
      ON r.id = us.role_id

    LEFT JOIN DEPARTMENTS d
      ON d.id = us.department_id

    LEFT JOIN DAILY_WORK w
      ON w.user_id = us.id
      AND w.work_date = ?

    WHERE
      us.active = 1
      ${
        u.department_id
          ? `AND us.department_id = ${u.department_id}`
          : `AND us.id = ${u.id}`
      }

    ORDER BY us.full_name
  `).bind(vnNow.date).all<any>()

  /*
   * Chỉ lấy request đã APPROVED của hôm nay.
   * Pending/Rejected không làm thay đổi trạng thái realtime.
   */
  const requests = await env.DB.prepare(`
    SELECT
      id,
      user_id,
      request_type,
      start_date,
      end_date,
      start_time,
      end_time,
      expected_minutes,
      reason
    FROM LEAVE_REQUESTS
    WHERE status = 'APPROVED'
      AND ? BETWEEN start_date
      AND COALESCE(end_date, start_date)
    ORDER BY id DESC
  `).bind(vnNow.date).all<any>()

  const requestsByUser = new Map<number, any[]>()

  for (const request of requests.results) {
    const userId = Number(request.user_id)
    const list = requestsByUser.get(userId) || []
    list.push(request)
    requestsByUser.set(userId, list)
  }

  const items = users.results.map((user: any) => {
    let status = workingToday
      ? getDefaultRealtimeStatus(vnNow.time, config)
      : 'NON_WORKING'

    let activeRequest: any = null

    /*
     * Ngày nghỉ theo QĐ là trạng thái nền cao nhất.
     * Request không override ngày không làm việc.
     */
    if (workingToday) {
      const userRequests =
        requestsByUser.get(Number(user.id)) || []

      const nowMinutes = timeToMinutes(vnNow.time)
      const morningStart =
        timeToMinutes(config.morning_start)
      const morningEnd =
        timeToMinutes(config.morning_end)
      const afternoonStart =
        timeToMinutes(config.afternoon_start)
      const afternoonEnd =
        timeToMinutes(config.afternoon_end)

      /*
       * Nghỉ phép cả ngày ưu tiên cao nhất.
       */
      const inWorkingHours =
  (nowMinutes >= morningStart &&
    nowMinutes < morningEnd) ||
  (nowMinutes >= afternoonStart &&
    nowMinutes < afternoonEnd)

if (inWorkingHours) {
  activeRequest = userRequests.find(
    request =>
      request.request_type === 'FULL_DAY_LEAVE' ||
      request.request_type === 'ANNUAL_LEAVE'
  )

  if (activeRequest) {
    status = 'FULL_DAY_LEAVE'
  }
}

      /*
       * Làm việc từ xa áp dụng trong giờ làm việc.
       */
      if (!activeRequest) {
        const remote = userRequests.find(
          request => request.request_type === 'REMOTE'
        )


        if (remote && inWorkingHours) {
          activeRequest = remote
          status = 'REMOTE'
        }
      }

      /*
       * Nghỉ buổi sáng.
       */
      if (
        !activeRequest &&
        nowMinutes >= morningStart &&
        nowMinutes < morningEnd
      ) {
        const morningLeave = userRequests.find(
          request =>
            request.request_type === 'MORNING_LEAVE'
        )

        if (morningLeave) {
          activeRequest = morningLeave
          status = 'MORNING_LEAVE'
        }
      }

      /*
       * Nghỉ buổi chiều.
       */
      if (
        !activeRequest &&
        nowMinutes >= afternoonStart &&
        nowMinutes < afternoonEnd
      ) {
        const afternoonLeave = userRequests.find(
          request =>
            request.request_type === 'AFTERNOON_LEAVE'
        )

        if (afternoonLeave) {
          activeRequest = afternoonLeave
          status = 'AFTERNOON_LEAVE'
        }
      }

      /*
       * Đi muộn:
       * từ giờ bắt đầu buổi sáng đến
       * morning_start + expected_minutes.
       *
       * Dữ liệu cũ thiếu expected_minutes sẽ không được đoán.
       */
      if (!activeRequest) {
        const late = userRequests.find(
          request =>
            request.request_type === 'LATE' &&
            Number(request.expected_minutes) > 0
        )

        if (late) {
          const lateEnd =
            morningStart +
            Number(late.expected_minutes)

          if (
            isTimeInMinuteRange(
              vnNow.time,
              morningStart,
              lateEnd
            )
          ) {
            activeRequest = late
            status = 'LATE'
          }
        }
      }

      /*
       * Về sớm:
       * từ afternoon_end - expected_minutes
       * đến hết giờ làm việc.
       */
      if (!activeRequest) {
        const early = userRequests.find(
          request =>
            request.request_type === 'EARLY_LEAVE' &&
            Number(request.expected_minutes) > 0
        )

        if (early) {
          const earlyStart =
            afternoonEnd -
            Number(early.expected_minutes)

          if (
            isTimeInMinuteRange(
              vnNow.time,
              earlyStart,
              afternoonEnd
            )
          ) {
            activeRequest = early
            status = 'EARLY_LEAVE'
          }
        }
      }
    }

    return {
      ...user,
      status,
      request_type:
        activeRequest?.request_type || null,
      expected_minutes:
        activeRequest?.expected_minutes || null,
      start_time:
        activeRequest?.start_time || null,
      end_time:
        activeRequest?.end_time || null,
      reason:
        activeRequest?.reason || null
    }
  })

  return json({
    date: vnNow.date,
    time: vnNow.time,
    is_working_day: workingToday,
    items
  }, 200, h)
}
// ================== LEAVE REQUEST HISTORY ==================
if (url.pathname === '/api/leave-requests' && req.method === 'GET') {
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''
  const userId = url.searchParams.get('user_id') || ''

  const conditions: string[] = []
  const params: any[] = []

  if (from) {
    conditions.push(`date(COALESCE(lr.end_date, lr.start_date)) >= date(?)`)
    params.push(from)
  }

  if (to) {
    conditions.push(`date(lr.start_date) <= date(?)`)
    params.push(to)
  }

  if (userId) {
    conditions.push(`lr.user_id = ?`)
    params.push(Number(userId))
  }

  const where =
    conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

  const result = await env.DB.prepare(`
    SELECT
      lr.id,
      lr.user_id,
      us.full_name,
      us.username,
      d.name AS department,
      lr.request_type,
      lr.start_date,
      lr.end_date,
      lr.start_time,
      lr.end_time,
      lr.expected_minutes,
      lr.reason,
      lr.return_to_work_date,
      lr.makeup_leave,
      lr.status,
      lr.requested_at,
      lr.updated_at
    FROM LEAVE_REQUESTS lr
    JOIN USERS us ON us.id = lr.user_id
    LEFT JOIN DEPARTMENTS d ON d.id = us.department_id
    ${where}
    ORDER BY
      COALESCE(lr.start_date, substr(lr.requested_at, 1, 10)) DESC,
      lr.requested_at DESC,
      lr.id DESC
  `).bind(...params).all()

  return json({
    items: result.results
  }, 200, h)
}

 if (url.pathname === '/api/leave-requests' && req.method === 'POST') {
  const b = await req.json<any>()

  if (!TYPES.has(b.request_type)) {
    return json({ message: 'Loại yêu cầu không hợp lệ' }, 400, h)
  }

  const startDate = b.start_date || null
  const endDate = b.end_date || b.start_date || null

  if (!startDate) {
    return json({ message: 'Ngày yêu cầu là bắt buộc' }, 400, h)
  }
  if (endDate < startDate) {
    return json({
      message: 'Đến ngày không được nhỏ hơn từ ngày.'
    }, 400, h)
  }

  const workingDates = await getWorkingDatesInRange(
    env,
    startDate,
    endDate
  )

  if (workingDates.length === 0) {
    return json({
      message:
        'Khoảng thời gian yêu cầu không có ngày làm việc hợp lệ.'
    }, 400, h)
  }

  // Yêu cầu một ngày phải đúng ngày làm việc.
  // Yêu cầu nhiều ngày được phép đi qua cuối tuần/ngày nghỉ;
  // các ngày không làm việc trong khoảng sẽ được bỏ qua.
  if (
    startDate === endDate &&
    workingDates[0] !== startDate
  ) {
    return json({
      message:
        'Ngày đã chọn là ngày nghỉ theo QĐ, không thể tạo yêu cầu.'
    }, 400, h)
  }
  /*
   * Không cho gửi lại cùng loại yêu cầu nếu đã có
   * PENDING hoặc APPROVED trong ngày / khoảng ngày giao nhau.
   *
   * REJECTED được phép gửi lại.
   */
  const duplicate = await env.DB.prepare(`
    SELECT id
    FROM LEAVE_REQUESTS
    WHERE user_id = ?
      AND request_type = ?
      AND status IN ('PENDING', 'APPROVED')
      AND date(COALESCE(start_date, requested_at))
          <= date(?)
      AND date(COALESCE(end_date, start_date, requested_at))
          >= date(?)
    LIMIT 1
  `).bind(
    u.id,
    b.request_type,
    endDate,
    startDate
  ).first()

  if (duplicate) {
    return json({
      message: 'Bạn đã có yêu cầu cùng loại trong ngày hoặc khoảng thời gian này'
    }, 409, h)
  }

  // Đọc cấu hình xem loại yêu cầu này có cần phê duyệt hay không
const approvalSetting = await env.DB.prepare(`
  SELECT setting_value
  FROM SYSTEM_SETTINGS
  WHERE setting_key = ?
`).bind(
  `approval_${b.request_type}`
).first<{ setting_value: string }>()

// Nếu không tìm thấy cấu hình thì mặc định vẫn yêu cầu phê duyệt
const requiresApproval =
  approvalSetting?.setting_value !== '0'

const requestStatus =
  requiresApproval ? 'PENDING' : 'APPROVED'

const result = await env.DB.prepare(`
  INSERT INTO LEAVE_REQUESTS (
    user_id,
    request_type,
    start_date,
    end_date,
    start_time,
    end_time,
    expected_minutes,
    reason,
    return_to_work_date,
    makeup_leave,
    handover_to_user_id,
    note,
    status
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  u.id,
  b.request_type,
  startDate,
  endDate,
  b.start_time || null,
  b.end_time || null,
  b.expected_minutes || null,
  b.reason || null,
  b.return_to_work_date || null,
  b.makeup_leave ? 1 : 0,
  b.handover_to_user_id || null,
  b.note || null,
  requestStatus
).run()

return json({
  id: result.meta.last_row_id,
  status: requestStatus,
  requires_approval: requiresApproval,
  message: requiresApproval
    ? 'Yêu cầu đã được gửi và đang chờ phê duyệt'
    : 'Yêu cầu đã được ghi nhận và có hiệu lực ngay'
}, 201, h)
}
 if(url.pathname==='/api/approvals/pending'&&req.method==='GET'&&manager(u)){const r=await env.DB.prepare(`SELECT lr.*,us.full_name FROM LEAVE_REQUESTS lr JOIN USERS us ON us.id=lr.user_id WHERE lr.status='PENDING' ${u.role_code==='TRUONG_PHONG'&&u.department_id?`AND us.department_id=${u.department_id}`:''} ORDER BY lr.requested_at DESC`).all();return json({items:r.results},200,h)}
 const m=url.pathname.match(/^\/api\/leave-requests\/(\d+)\/(approve|reject)$/);if(m&&req.method==='POST'&&manager(u)){const id=Number(m[1]),action=m[2]==='approve'?'APPROVED':'REJECTED';const b: { comment?: string } =
  await req.json<{ comment?: string }>()
    .catch((): { comment?: string } => ({}));await env.DB.batch([env.DB.prepare(`UPDATE LEAVE_REQUESTS SET status=?,updated_at=datetime('now') WHERE id=?`).bind(action,id),env.DB.prepare(`INSERT INTO LEAVE_APPROVALS(request_id,approver_id,action,comment) VALUES(?,?,?,?)`).bind(id,u.id,action,b.comment||null)]);return json({ok:true,status:action},200,h)}
 if(url.pathname==='/api/stats/personal'){const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);const r=await env.DB.prepare(`SELECT request_type,COUNT(*) count,COALESCE(SUM(expected_minutes),0) minutes FROM LEAVE_REQUESTS WHERE user_id=? AND status='APPROVED' AND substr(start_date,1,7)=? GROUP BY request_type`).bind(u.id,month).all();return json({month,items:r.results},200,h)}
 if(url.pathname==='/api/stats/department'&&manager(u)){const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);const r=await env.DB.prepare(`SELECT us.full_name,lr.request_type,COUNT(*) count,COALESCE(SUM(lr.expected_minutes),0) minutes FROM LEAVE_REQUESTS lr JOIN USERS us ON us.id=lr.user_id WHERE lr.status='APPROVED' AND substr(lr.start_date,1,7)=? ${u.role_code==='TRUONG_PHONG'&&u.department_id?`AND us.department_id=${u.department_id}`:''} GROUP BY us.id,lr.request_type ORDER BY us.full_name`).bind(month).all();return json({month,items:r.results},200,h)}
 // ================== ADMIN DELETE DAILY WORK ==================
const deleteWorkMatch = url.pathname.match(/^\/api\/daily-work\/(\d+)$/)

if (deleteWorkMatch && req.method === 'DELETE') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Chỉ ADMIN được phép xóa công việc' }, 403, h)
  }

  const id = Number(deleteWorkMatch[1])

  const work = await env.DB.prepare(`
    SELECT
      dw.id,
      dw.user_id,
      dw.work_date,
      dw.work_content,
      us.full_name
    FROM DAILY_WORK dw
    JOIN USERS us ON us.id = dw.user_id
    WHERE dw.id = ?
  `).bind(id).first<any>()

  if (!work) {
    return json({ message: 'Không tìm thấy công việc' }, 404, h)
  }

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO AUDIT_LOGS (
        user_id,
        action,
        entity_type,
        entity_id,
        detail
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      u.id,
      'DELETE',
      'DAILY_WORK',
      id,
      JSON.stringify({
        owner_user_id: work.user_id,
        full_name: work.full_name,
        work_date: work.work_date,
        work_content: work.work_content
      })
    ),

    env.DB.prepare(`
      DELETE FROM DAILY_WORK
      WHERE id = ?
    `).bind(id)
  ])

  return json({
    ok: true,
    message: 'Đã xóa công việc'
  }, 200, h)
}


// ================== ADMIN DELETE LEAVE REQUEST ==================
const deleteLeaveMatch = url.pathname.match(/^\/api\/leave-requests\/(\d+)$/)

if (deleteLeaveMatch && req.method === 'DELETE') {
  if (u.role_code !== 'ADMIN') {
    return json({ message: 'Chỉ ADMIN được phép xóa yêu cầu' }, 403, h)
  }

  const id = Number(deleteLeaveMatch[1])

  const leave = await env.DB.prepare(`
    SELECT
      lr.*,
      us.full_name
    FROM LEAVE_REQUESTS lr
    JOIN USERS us ON us.id = lr.user_id
    WHERE lr.id = ?
  `).bind(id).first<any>()

  if (!leave) {
    return json({ message: 'Không tìm thấy yêu cầu' }, 404, h)
  }

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO AUDIT_LOGS (
        user_id,
        action,
        entity_type,
        entity_id,
        detail
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      u.id,
      'DELETE',
      'LEAVE_REQUEST',
      id,
      JSON.stringify({
        owner_user_id: leave.user_id,
        full_name: leave.full_name,
        request_type: leave.request_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        start_time: leave.start_time,
        end_time: leave.end_time,
        reason: leave.reason,
        status: leave.status
      })
    ),

    env.DB.prepare(`
      DELETE FROM LEAVE_APPROVALS
      WHERE request_id = ?
    `).bind(id),

    env.DB.prepare(`
      DELETE FROM LEAVE_REQUESTS
      WHERE id = ?
    `).bind(id)
  ])

  return json({
    ok: true,
    message: 'Đã xóa yêu cầu'
  }, 200, h)
}
 return json({message:'Not found'},404,h)
 }catch(e){console.error(e);return json({message:'Internal server error'},500,h)}}}
