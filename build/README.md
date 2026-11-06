# Thư mục build

Nơi lưu **từng bản APK** của Đi Tu Online.

## Quy ước tên file

```
DiTuOnline-v<phiên bản>-<YYYYMMDD-HHmm>-debug.apk
```

Ví dụ: `DiTuOnline-v1.0.0-20261106-1648-debug.apk`

- `<phiên bản>` lấy từ `version` trong `package.json`.
- `<YYYYMMDD-HHmm>` là thời điểm build, để mỗi lần build là một bản riêng.

## Tạo bản mới

```bash
npm run android:apk
```

Lệnh này build APK rồi tự động copy vào đây và ghi thêm một dòng vào
[versions.md](versions.md).

Nếu đã có sẵn APK trong `android/app/build/outputs/apk/debug/`, chỉ cần:

```bash
node scripts/collect-apk.mjs
```

## Cài lên điện thoại

```bash
adb install -r build/DiTuOnline-v1.0.0-20261106-1648-debug.apk
```

Hoặc chuyển file `.apk` sang máy và mở để cài (cần bật "Cài từ nguồn không xác định").

## Lưu ý

- Đây là bản **debug**, ký bằng debug keystore — cài trực tiếp được nhưng không dùng để phát hành lên Google Play.
- Mỗi APK khoảng **4.5 MB**. Nếu commit tất cả các bản vào git, repo sẽ phình dần.
  Nên giữ 1–2 bản gần nhất trong repo, còn các bản cũ đưa lên **GitHub Releases** (miễn phí, không tính vào dung lượng repo).
- Bản release (ký bằng keystore riêng) sẽ tạo bằng `npm run android:bundle`.
