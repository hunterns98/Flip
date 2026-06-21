// firebase.js - Firebase Configuration & Initialization
// ─────────────────────────────────────────────────────
// BƯỚC BẮT BUỘC: Thay thế các giá trị bên dưới bằng config
// từ Firebase Console > Project Settings > Your Apps > Web App
// ─────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Kiểm tra config trước khi init ───────────────────
const _configOK = !Object.values(firebaseConfig).some(v =>
  v.includes('YOUR_') || v === ''
);

if (!_configOK) {
  // Hiển thị hướng dẫn thay vì crash
  document.addEventListener('DOMContentLoaded', function () {
    document.body.innerHTML = `
      <div style="
        font-family: monospace;
        background: #0f2218;
        color: #f0ede6;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      ">
        <div style="max-width:560px; background:#1e3d2e; border:1px solid #f5c842; border-radius:12px; padding:32px;">
          <div style="font-size:2rem; margin-bottom:8px;">🔧 Cần cấu hình Firebase</div>
          <p style="color:#a8c4b4; margin-bottom:20px;">File <code>firebase.js</code> chưa được điền thông tin Firebase project.</p>

          <div style="background:#0f2218; border-radius:8px; padding:16px; margin-bottom:20px;">
            <div style="color:#f5c842; font-weight:bold; margin-bottom:12px;">📋 Các bước thực hiện:</div>
            <ol style="color:#f0ede6; line-height:2; padding-left:20px;">
              <li>Vào <a href="https://console.firebase.google.com" target="_blank" style="color:#4a9eed;">console.firebase.google.com</a></li>
              <li>Tạo project mới (hoặc chọn project có sẵn)</li>
              <li>Vào <b>Project Settings ⚙️</b> → tab <b>General</b></li>
              <li>Kéo xuống mục <b>"Your apps"</b> → nhấn <b>&lt;/&gt; Web</b></li>
              <li>Đăng ký app → copy đoạn <code>firebaseConfig</code></li>
              <li>Mở file <code>firebase.js</code> và dán config vào</li>
            </ol>
          </div>

          <div style="background:#0f2218; border-radius:8px; padding:16px;">
            <div style="color:#f5c842; font-weight:bold; margin-bottom:8px;">📝 Mẫu firebase.js:</div>
            <pre style="color:#81c784; font-size:0.8rem; white-space:pre-wrap; margin:0;">const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXX",
  authDomain: "my-game.firebaseapp.com",
  projectId: "my-game",
  storageBucket: "my-game.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};</pre>
          </div>

          <div style="margin-top:20px; color:#a8c4b4; font-size:0.85rem;">
            💡 Ngoài ra cần bật <b>Firestore Database</b> trong Firebase Console (chọn <b>Start in test mode</b>)
          </div>
        </div>
      </div>
    `;
  });

  // Tạo stub để tránh các module khác crash khi import
  window.db = null;

} else {

  // ── Init Firebase bình thường ─────────────────────
  try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // Offline persistence (reconnect khi mất mạng)
    db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      if (err.code === 'failed-precondition') {
        console.warn('[Flip7] Persistence: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('[Flip7] Persistence not supported');
      }
    });

    window.db = db;
    console.log('[Flip7] Firebase connected ✓ project:', firebaseConfig.projectId);

  } catch (err) {
    console.error('[Flip7] Firebase init error:', err);

    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = `
        <div style="font-family:monospace; background:#0f2218; color:#f0ede6; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px;">
          <div style="max-width:560px; background:#4a1e1e; border:1px solid #e84343; border-radius:12px; padding:32px;">
            <div style="font-size:2rem;">⚠️ Lỗi Firebase</div>
            <p style="margin-top:12px; color:#f0ede6;">${err.message}</p>
            <p style="margin-top:12px; color:#a8c4b4;">Kiểm tra lại <code>firebase.js</code> — đảm bảo <b>projectId</b> đúng và <b>Firestore đã được bật</b> trong Firebase Console.</p>
          </div>
        </div>
      `;
    });

    window.db = null;
  }

}
