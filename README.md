# ITCA-Mangement V2

Ứng dụng quản lý ngày làm việc theo mockup đỏ bordeaux: dashboard hôm nay, cập nhật công việc, xin nghỉ/đi muộn/về sớm, phê duyệt, thống kê cá nhân và giao diện responsive.

## Kiến trúc
- Frontend: Vue 3 + TypeScript + Vite + Vuetify
- API: Cloudflare Workers
- DB: Cloudflare D1 (`qlnp-db`, giữ DB hiện tại)
- Auth V2: PBKDF2 + salt, opaque session token lưu trong D1

## Chạy local
Frontend:
```bash
cd frontend
npm install
npm run dev
```
Worker:
```bash
cd worker
npm install
npx wrangler dev
```
Tạo `frontend/.env.local`:
```env
VITE_API_BASE_URL=http://localhost:8787
```
Khi local, nếu cookie Secure gây khó đăng nhập, nên test qua URL workers.dev/Pages preview hoặc tạm điều chỉnh cookie trong môi trường dev.

## D1 production
```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 migrations apply qlnp-db --remote
```

## Tạo admin đầu tiên an toàn
Không hard-code mật khẩu. Tạo secret:
```bash
npx wrangler secret put BOOTSTRAP_SECRET
```
Sau khi deploy Worker, gọi `POST /api/auth/bootstrap` một lần với header `X-Bootstrap-Secret` và JSON:
```json
{"username":"admin","password":"MAT_KHAU_MANH_CUA_BAN","full_name":"Quản trị ITCA"}
```
Endpoint tự khóa sau khi đã có user.

## Deploy Worker
```bash
npx wrangler deploy
```
Sau đó đặt `ALLOWED_ORIGIN` trong `worker/wrangler.jsonc` đúng URL Pages thực tế.

## Deploy Pages
- Repository: `nhatnghe/itca-mangement`
- Root directory: `frontend`
- Build command: `npm run build`
- Output: `dist`
- Env: `VITE_API_BASE_URL=https://<worker>.workers.dev`

## Chức năng V2
- Dashboard tình hình nhân sự hôm nay
- Cập nhật “Hôm nay tôi làm gì?” + Office/Remote
- Nghỉ sáng, chiều, cả ngày, nhiều ngày, đi muộn, về sớm
- Bàn giao công việc và ghi chú (không upload file)
- Trưởng phòng/Admin duyệt hoặc từ chối
- Thống kê cá nhân theo tháng
- API thống kê phòng ban
- Mobile-first bordeaux UI
