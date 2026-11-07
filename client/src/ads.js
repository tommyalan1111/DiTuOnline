import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
} from '@capacitor-community/admob';
import { IS_NATIVE } from './config.js';

/* ------------------------------------------------------------------ */
/* banner quảng cáo (AdMob)                                            */
/* ------------------------------------------------------------------ */

// Ba màn hình có banner: đăng nhập, đăng ký (chung screen "auth") và chọn chùa.
// Các màn hình còn lại (chọn giới tính, trong chùa) ẩn banner.
const AD_SCREENS = new Set(['auth', 'temples']);

// Đang dùng quảng cáo thử nghiệm của Google.
// Khi phát hành thật:
//   1. Đổi APPLICATION_ID trong android/app/src/main/AndroidManifest.xml
//   2. Đặt BANNER_AD_ID thành ID banner thật và TESTING = false
const TESTING = true;
const BANNER_AD_ID = 'ca-app-pub-3940256099942544/6300978111';

// Chiều cao dự phòng (CSS px) trước khi AdMob báo kích thước thật.
// WebView Android: 1 CSS px ≈ 1 dp nên dùng trực tiếp được.
const FALLBACK_H = 56;

let initPromise = null;
let desired = false;
let visible = false;
let chain = Promise.resolve();
let inset = 0;

function setInset(px) {
  const next = Math.max(0, Math.round(px || 0));
  if (next === inset) return;
  inset = next;
  document.documentElement.style.setProperty('--ad-h', `${next}px`);
}

function warn(message, err) {
  // Quảng cáo không bao giờ được làm hỏng trải nghiệm chính.
  console.warn(`[ads] ${message}`, err);
}

function init() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await AdMob.initialize({ initializeForTesting: TESTING });

      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
        if (!desired || !visible) return;
        setInset(size?.height || FALLBACK_H);
      });

      await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
        warn('không tải được banner', err?.message || err);
        // Không giữ khoảng trống nếu quảng cáo không về.
        setInset(0);
      });
    } catch (err) {
      warn('không khởi tạo được AdMob', err);
    }
  })();

  return initPromise;
}

async function show() {
  if (visible) return;
  visible = true;
  setInset(FALLBACK_H);

  // showBanner tạo banner nếu chưa có. Khi banner đã tồn tại, plugin 7.2.0 chỉ
  // nạp lại quảng cáo mà không resolve promise, nên không await ở đây.
  AdMob.showBanner({
    adId: BANNER_AD_ID,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: TESTING,
  }).catch((err) => {
    visible = false;
    setInset(0);
    warn('không hiện được banner', err);
  });

  try {
    // showBanner không bật lại view đã bị hide — resumeBanner làm việc đó.
    await AdMob.resumeBanner();
  } catch (err) {
    // Chưa có banner nào để resume: showBanner ở trên đang tạo mới.
  }
}

async function hide() {
  visible = false;
  setInset(0);

  try {
    // Gọi kể cả khi JS vừa tải lại (visible = false nhưng banner native vẫn còn).
    await AdMob.hideBanner();
  } catch (err) {
    // Chưa từng hiện banner thì plugin báo lỗi — bỏ qua.
  }
}

function apply() {
  if (!desired) return hide();
  return init().then(show);
}

/**
 * Đồng bộ banner theo màn hình đang mở.
 * Chỉ có tác dụng trên app Android (native); trên web là no-op.
 */
export function syncAdBanner(screen) {
  if (!IS_NATIVE) return;

  desired = AD_SCREENS.has(screen);
  chain = chain.then(apply, apply);
}

/** Gọi một lần lúc khởi động để nạp SDK AdMob sớm. */
export function initAds() {
  if (!IS_NATIVE) return;
  init();
}
