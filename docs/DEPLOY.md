# Triển khai Đi Tu Online lên Internet

Mục tiêu: có một địa chỉ `https://...` để bạn bè ở ngoài mạng Wi-Fi vào chơi.

Có 3 cách, chọn theo nhu cầu:

| Cách | Thời gian | Dữ liệu | Phù hợp |
| --- | --- | --- | --- |
| **A. Render (Free)** | ~10 phút | Mất khi deploy lại | Demo, chơi với bạn bè |
| **B. Cloudflare Tunnel** | ~2 phút | Giữ nguyên (trên máy bạn) | Chơi thử ngay hôm nay, máy tính phải bật |
| **C. VPS miễn phí (Oracle)** | ~40 phút | Giữ nguyên | Chạy lâu dài, miễn phí thật |

---

## A. Render — nhanh nhất

### 1. Đẩy code lên GitHub

```bash
git add .
git commit -m "chuan bi deploy"
git push
```

### 2. Tạo tài khoản Render

- Vào <https://render.com> → **Sign up** bằng GitHub.
- Không cần thẻ tín dụng cho gói Free.

### 3. Tạo service

Cách nhanh (dùng Blueprint, đã có sẵn `render.yaml`):

1. Dashboard → **New** → **Blueprint**.
2. Chọn repo `tommyalan1111/DiTuOnline`.
3. Render đọc `render.yaml` → bấm **Apply**.

Cách thủ công (nếu Blueprint lỗi):

1. **New** → **Web Service** → chọn repo.
2. Điền:
   - **Runtime**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
   - **Region**: Singapore
3. **Environment Variables**:
   - `NODE_VERSION` = `24`
   - `NODE_ENV` = `production`
   - `AUTH_SECRET` = một chuỗi ngẫu nhiên dài (hoặc để Render generate)
4. **Create Web Service** → đợi build ~2–3 phút.

### 4. Lấy địa chỉ

Render cấp URL dạng:

```
https://ditu-online.onrender.com
```

Mở thử: `https://ditu-online.onrender.com/api/health` phải thấy `{"ok":true,...}`.

### 5. Trỏ app Android vào đó

Trên điện thoại: màn hình đăng nhập → nút **Máy chủ** → nhập `https://ditu-online.onrender.com` → **Lưu & tải lại**.

> Không cần `http://`, không cần `:3000`. Render đã có HTTPS.

### Lưu ý gói Free của Render

- Service **ngủ sau 15 phút** không có người dùng. Lần truy cập đầu tiên sẽ chậm ~30–60 giây, sau đó bình thường. Socket.IO tự kết nối lại.
- **Không có ổ đĩa vĩnh viễn**: file `data/ditu.db` bị xoá mỗi lần deploy/restart → tài khoản và công đức mất.
- Muốn giữ dữ liệu: nâng gói Starter (~7 USD/tháng) + gắn Disk 1GB (xem phần bình luận trong `render.yaml`), hoặc dùng cách C.
- 512MB RAM / 0.1 CPU: đủ cho vài chục người chơi, chưa phù hợp 500 người cùng lúc.

### Dữ liệu tạm thời — chấp nhận được không?

Với demo/testing: được. Với người dùng thật: nên dùng cách C hoặc nâng gói có disk.
Có thể backup định kỳ bằng cách gọi API nội bộ, nhưng đơn giản nhất vẫn là dùng ổ đĩa.

---

## B. Cloudflare Tunnel — 2 phút, không cần tài khoản

Dùng khi muốn bạn bè vào chơi ngay, chấp nhận máy tính của bạn phải bật.

```bash
# cài 1 lần
brew install cloudflared

# đang chạy server ở cổng 3000
npm start
```

Terminal khác:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflared in ra một địa chỉ dạng:

```
https://random-words.trycloudflare.com
```

Gửi địa chỉ này cho bạn bè, hoặc nhập vào app Android ở nút **Máy chủ**.

- Miễn phí, không cần đăng ký.
- **URL đổi mỗi lần chạy lại** và chỉ sống khi máy bạn bật + lệnh còn chạy.
- Tốc độ phụ thuộc mạng nhà bạn.

---

## C. Oracle Cloud Always Free — miễn phí lâu dài, có dữ liệu

> Hướng dẫn chi tiết từng bước: **[DEPLOY-ORACLE.md](DEPLOY-ORACLE.md)**.
> Dưới đây là bản tóm tắt.

Oracle cho 1 máy ảo ARM (4 CPU, 24GB RAM, 200GB đĩa) **miễn phí vĩnh viễn**, phù hợp chạy game này.
Cần thẻ để xác minh (không bị trừ tiền nếu chỉ dùng gói Always Free).

### 1. Tạo máy ảo

1. Đăng ký <https://cloud.oracle.com/free>.
2. **Compute → Instances → Create Instance**.
3. Image: **Ubuntu 24.04**, Shape: **Ampere A1 (Always Free)**.
4. Tải SSH key, tạo máy, mở port **80** và **443** trong Security List (và `ufw` trên máy).

### 2. Cài môi trường

```bash
ssh ubuntu@<IP-máy-ảo>

sudo apt update && sudo apt install -y git curl caddy
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # phải >= 24
```

### 3. Lấy code và build

```bash
git clone https://github.com/tommyalan1111/DiTuOnline.git
cd DiTuOnline
npm ci
npm run build
mkdir -p data
```

### 4. Chạy như dịch vụ nền

Tạo `/etc/systemd/system/ditu.service`:

```ini
[Unit]
Description=Di Tu Online
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/DiTuOnline
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/home/ubuntu/DiTuOnline/data
Environment=AUTH_SECRET=doi-mot-chuoi-bi-mat-that-dai-o-day
User=ubuntu

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now ditu
sudo systemctl status ditu
```

### 5. HTTPS bằng Caddy

Sửa `/etc/caddy/Caddyfile`:

```
ditu.duckdns.org {
    reverse_proxy localhost:3000
}
```

- Có thể dùng tên miền riêng, hoặc tên miền miễn phí DuckDNS (`ditu.duckdns.org` trỏ về IP máy ảo).
- Caddy tự xin chứng chỉ HTTPS.

```bash
sudo systemctl reload caddy
```

Xong: mở `https://ditu.duckdns.org/api/health`.

> Nếu chưa có tên miền, có thể dùng `sslip.io`: `https://<IP>.sslip.io` (Caddy vẫn xin được chứng chỉ).

### 6. Cập nhật code sau này

```bash
cd ~/DiTuOnline && git pull && npm ci && npm run build && sudo systemctl restart ditu
```

---

## Sau khi deploy

- Nhập URL HTTPS vào app Android (nút **Máy chủ**).
- Kiểm tra: mở URL trên trình duyệt, đăng ký thử một tài khoản.
- Nếu dùng Render Free: nhớ rằng deploy lại = mất dữ liệu.
- Nhớ đặt `AUTH_SECRET` cố định, nếu không người chơi sẽ bị đăng xuất sau mỗi lần restart.
