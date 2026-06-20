# 🃏 Flip 7 – Online Multiplayer Game

Web game Flip 7 chơi realtime với Firebase Firestore + Hosting.  
Hỗ trợ 2–15 người chơi, đồng bộ realtime, tự động reconnect.

---

## 📁 Cấu trúc file

```
flip7-game/
├── index.html          # Trang người chơi (join + game)
├── admin.html          # Trang admin (tạo phòng + quản lý)
├── style.css           # Toàn bộ CSS (dark felt theme)
├── firebase.js         # Firebase config (cần sửa)
├── deck.js             # Logic bộ bài + tính điểm
├── game.js             # Logic game + Firebase sync
├── ui.js               # Render UI + helpers
├── firebase.json       # Firebase Hosting config
├── firestore.rules     # Firestore security rules
├── firestore.indexes.json
└── .firebaserc         # Firebase project ID (cần sửa)
```

---

## 🚀 Hướng dẫn Deploy Firebase

### Bước 1: Tạo Firebase Project

1. Vào [https://console.firebase.google.com](https://console.firebase.google.com)
2. Nhấn **"Add project"** → đặt tên → tạo project
3. Trong project, vào **Firestore Database** → **Create database**
   - Chọn **Start in test mode** (để dev, sau đổi rules)
   - Chọn region gần nhất (ví dụ: `asia-southeast1`)
4. Vào **Project Settings** (⚙️ icon) → tab **"Your apps"**
5. Nhấn **"</> Web"** → đặt tên app → **Register app**
6. Copy đoạn `firebaseConfig` được cung cấp

### Bước 2: Cập nhật firebase.js

Mở file `firebase.js` và thay thế:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",              // ← dán vào đây
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project",
  storageBucket: "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

### Bước 3: Cập nhật .firebaserc

Mở `.firebaserc`, thay `YOUR_PROJECT_ID` bằng project ID của bạn:

```json
{
  "projects": {
    "default": "my-flip7-game"
  }
}
```

### Bước 4: Cài Firebase CLI

```bash
npm install -g firebase-tools
```

### Bước 5: Đăng nhập Firebase

```bash
firebase login
```

Trình duyệt sẽ mở ra → đăng nhập Google account.

### Bước 6: Deploy

Vào thư mục project:

```bash
cd flip7-game
firebase deploy
```

Lệnh này sẽ deploy:
- **Hosting** → upload tất cả file HTML/CSS/JS lên CDN
- **Firestore Rules** → áp dụng security rules

Sau khi deploy xong, bạn nhận được URL dạng:
```
Hosting URL: https://my-flip7-game.web.app
```

---

## 🎮 Hướng dẫn chơi

### Admin tạo phòng
1. Vào `https://your-app.web.app/admin.html`
2. Nhập tên → **"Tạo Phòng"**
3. Nhận mã phòng 6 ký tự (ví dụ: `ABC123`)
4. Chia sẻ mã cho người chơi
5. Đợi đủ người → **"Bắt đầu Game"**

### Người chơi tham gia
1. Vào `https://your-app.web.app`
2. Nhập tên + mã phòng → **"Vào Phòng"**
3. Đợi admin bắt đầu

### Luật chơi cơ bản
- Đến lượt: nhấn **🃏 Rút Bài** hoặc **✋ Dừng**
- Rút bài trùng số → **BUST** (mất điểm vòng)
- Dừng → lưu điểm vòng vào tổng
- Đạt **200 điểm** tổng → thắng

### Lá đặc biệt
| Lá | Tác dụng |
|----|----------|
| ❄️ Freeze | Chọn 1 người bị dừng ngay |
| 🍀 Second Chance | Thoát 1 lần bust |
| 🃏 Flip 3 | Tự động rút 3 lá liên tiếp |
| ×2 Double | Nhân đôi điểm số |
| +2 đến +10 | Cộng thêm điểm bonus |

### Flip 7 Bonus
- Nếu 1 người đạt **7 lá số khác nhau** → vòng kết thúc ngay
- Người đó nhận **+15 điểm thưởng**
- Tất cả người khác vẫn giữ điểm hiện tại (không mất)

---

## ⚙️ Cấu hình nâng cao

### Đổi điểm mục tiêu
Trong `game.js`, dòng đầu:
```js
const TARGET_SCORE = 200; // ← đổi thành 100, 300, v.v.
```

### Firestore Rules (production)
Sau khi test xong, cập nhật `firestore.rules` để bảo mật hơn:
```
allow update: if request.auth != null;
```
Và enable Firebase Authentication trong console.

### Xem log realtime
```bash
firebase functions:log
```

---

## 🐛 Troubleshooting

**Q: Firebase không kết nối?**  
→ Kiểm tra lại `firebase.js` có đúng config không. Mở DevTools (F12) xem Console.

**Q: Người chơi refresh mất game?**  
→ Session được lưu trong `sessionStorage`. Nếu đóng tab hoàn toàn thì phải join lại.

**Q: Deploy lỗi "permission denied"?**  
→ Chạy lại `firebase login` và chọn đúng account.

**Q: Firestore rules block request?**  
→ Tạm thời dùng test mode: vào Firebase Console → Firestore → Rules → set `allow read, write: if true;`

---

## 📦 Dependencies

Không có npm dependencies! Chỉ dùng:
- Firebase SDK 9 (via CDN)
- Google Fonts (Nunito + Space Grotesk)
- Vanilla HTML/CSS/JS thuần

---

## 🗺️ Roadmap

- [x] Phase 1: Core game (flip, bust, stop, score, win)
- [x] Phase 2: Special cards (Freeze, Second Chance, Flip3, Double, +bonus)
- [x] Phase 2: Flip 7 bonus event
- [ ] Phase 3: Card flip animations (CSS 3D)
- [ ] Phase 3: Sound effects
- [ ] Phase 3: Chat trong phòng
- [ ] Phase 3: Player avatars
- [ ] Phase 3: Game history / leaderboard
