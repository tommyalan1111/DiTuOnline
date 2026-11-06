# Deploy Đi Tu Online lên Oracle Cloud Always Free

Hướng dẫn này đưa game lên một máy ảo **miễn phí vĩnh viễn** của Oracle, có **ổ đĩa riêng**
nên tài khoản người chơi không bị mất khi restart. Thời gian khoảng **40 phút**.

> Yêu cầu: tài khoản Oracle Cloud (cần thẻ để xác minh, không bị trừ tiền nếu chỉ dùng
> gói Always Free), repo GitHub đang public.

---

## 0. Chọn region khi đăng ký

Region (home region) **không đổi được sau khi tạo tài khoản**. Ở Việt Nam nên chọn:

- **Singapore** (gần nhất)
- hoặc **Japan East (Tokyo)**

---

## 1. Tạo máy ảo

1. Vào <https://cloud.oracle.com> → **Compute → Instances → Create instance**.
2. Điền:
   - **Name**: `ditu`
   - **Image**: *Canonical Ubuntu 24.04*
   - **Shape**: **Ampere → VM.Standard.A1.Flex**
   - **OCPU**: 2, **Memory**: 12 GB (vẫn nằm trong hạn mức free 4 OCPU / 24 GB)
   - **Primary VNIC**: public subnet, **Assign a public IPv4 address** = Yes
   - **Boot volume**: 50 GB
3. **SSH keys**: chọn *Generate a key pair* → tải về file `.key` (private) và giữ cẩn thận.
4. **Create**.

> Nếu báo **"Out of host capacity"**: đổi Availability Domain, giảm OCPU xuống 1–2, hoặc thử lại
> vào giờ khác. Đây là lỗi rất phổ biến với shape Ampere, không phải lỗi của bạn.

Sau khi tạo xong, ghi lại **Public IP** (dạng `140.238.x.x`).

---

## 2. Mở cổng 80/443 (rất quan trọng)

Có **2 lớp** firewall, phải mở cả hai.

### 2a. Security List trên Oracle Cloud

**Networking → Virtual Cloud Networks → VCN của bạn → Security Lists → Default Security List**
→ **Add Ingress Rules**, thêm 2 luật:

| Source CIDR | Protocol | Destination Port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Cổng 22 cho SSH đã có sẵn.)

### 2b. Firewall trên máy Ubuntu

Image Ubuntu của Oracle có sẵn luật `iptables` chặn hết trừ SSH. SSH vào máy rồi chạy:

```bash
ssh -i ssh-key-....key ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt install -y iptables-persistent

# xem thứ tự luật, luật REJECT thường ở cuối
sudo iptables -L INPUT --line-numbers -n

# chèn luật cho 80/443 (vị trí 6 là trước REJECT trên image chuẩn)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Kiểm tra lại:

```bash
sudo iptables -L INPUT -n --line-numbers | head -12
```

---

## 3. Cài Node.js 24, git, Caddy

```bash
sudo apt install -y git curl caddy
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

node -v    # phải là v24.x
npm -v
```

> Nếu NodeSource báo không hỗ trợ bản Ubuntu này, cài bằng nvm:
> ```bash
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
> source ~/.bashrc && nvm install 24
> ```

---

## 4. Lấy code và build

```bash
cd ~
git clone https://github.com/tommyalan1111/DiTuOnline.git
cd DiTuOnline

npm ci
npm run build
mkdir -p data
```

Chạy thử:

```bash
PORT=3000 node server/index.js
```

Thấy dòng `Đi Tu Online · http://localhost:3000` là được. Mở terminal khác:

```bash
curl http://localhost:3000/api/health
```

→ `{"ok":true,...}`. Sau đó `Ctrl+C` để tắt bản chạy thử.

---

## 5. Chạy nền bằng systemd

```bash
# tạo khoá bí mật cho token đăng nhập
openssl rand -hex 32

sudo cp ~/DiTuOnline/deploy/ditu.service /etc/systemd/system/ditu.service
sudo nano /etc/systemd/system/ditu.service
```

Sửa dòng `Environment=AUTH_SECRET=...` thành chuỗi vừa tạo. Kiểm tra `WorkingDirectory` và
`DATA_DIR` đúng đường dẫn (`/home/ubuntu/DiTuOnline`).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ditu
sudo systemctl status ditu
```

Xem log trực tiếp:

```bash
journalctl -u ditu -f
```

---

## 6. HTTPS bằng Caddy

Caddy tự xin chứng chỉ Let's Encrypt. Bạn cần một tên miền trỏ về IP máy ảo.

### Cách A — DuckDNS (miễn phí, 2 phút)

1. Vào <https://www.duckdns.org> → đăng nhập → tạo subdomain, ví dụ `ditu-online`.
2. Ở ô **current ip**, điền **Public IP** của máy ảo → **update ip**.

### Cách B — Không cần tên miền

Dùng `sslip.io`, tên miền tự trỏ về IP:

```
https://<PUBLIC_IP>.sslip.io
```

Ví dụ IP `140.238.1.23` → `https://140.238.1.23.sslip.io`.

### Cấu hình Caddy

```bash
sudo cp ~/DiTuOnline/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Sửa dòng đầu thành tên miền của bạn, ví dụ:

```
ditu-online.duckdns.org {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
sudo journalctl -u caddy -n 30 --no-pager   # xem Caddy xin cert
```

Mở thử:

```
https://ditu-online.duckdns.org/api/health
```

> Nếu Caddy báo lỗi chứng chỉ: kiểm tra cổng 80/443 đã mở (bước 2), DNS đã trỏ đúng IP chưa
> (`dig ditu-online.duckdns.org +short`).

---

## 7. Trỏ app Android vào server

Mở app → màn hình đăng nhập → nút **Máy chủ** → nhập:

```
https://ditu-online.duckdns.org
```

→ **Lưu & tải lại** → đăng ký/đăng nhập.

Bạn bè ngoài mạng cũng dùng địa chỉ này, không cần Wi-Fi chung.

---

## 8. Cập nhật phiên bản mới

```bash
cd ~/DiTuOnline
git pull
npm ci
npm run build
sudo systemctl restart ditu
```

---

## 9. Sao lưu dữ liệu

Toàn bộ người chơi nằm trong `~/DiTuOnline/data/ditu.db`.

```bash
# dừng server để copy an toàn
sudo systemctl stop ditu
cp ~/DiTuOnline/data/ditu.db ~/ditu-$(date +%F).db
sudo systemctl start ditu
```

Nên backup định kỳ (cron) và tải file về máy.

---

## 10. Lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách sửa |
| --- | --- |
| Trình duyệt không vào được, `curl localhost:3000` vẫn OK | Chưa mở Security List hoặc iptables (bước 2) |
| `502 Bad Gateway` | Service `ditu` chết: `sudo systemctl status ditu`, xem `journalctl -u ditu -n 50` |
| Caddy không lấy được chứng chỉ | Cổng 80/443 bị chặn, hoặc DNS chưa trỏ đúng IP |
| `EADDRINUSE` | Có tiến trình cũ đang giữ cổng: `sudo lsof -i:3000` rồi `kill` |
| `SQLITE_READONLY` / không ghi được DB | Sai quyền thư mục `data`: `sudo chown -R ubuntu:ubuntu ~/DiTuOnline/data` |
| Build bị `Killed` (hết RAM) | Đang dùng shape 1GB; dùng Ampere A1 hoặc thêm swap |
| `Out of host capacity` khi tạo máy | Đổi Availability Domain / giảm OCPU / thử lại sau |

---

## 11. Giới hạn Always Free

- **4 OCPU + 24 GB RAM** Ampere A1 (có thể chia thành nhiều máy), **200 GB** ổ đĩa, **10 TB** băng thông ra/tháng.
- Tài nguyên Always Free gắn với **home region** đã chọn lúc đăng ký.
- Chỉ miễn phí khi nằm trong hạn mức trên; vượt quá sẽ bị tính phí.
- Nên **reserve public IP** (Instance → VNIC → Public IP → Reserved) để IP không đổi khi restart,
  tránh phải sửa lại DNS.
