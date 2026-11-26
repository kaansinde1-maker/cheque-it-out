# Cheque It Out — Android uygulaması

Web uygulamasını (React) bir Android uygulamasına saran proje. Hedef: **Android 14 (API 34)**, en düşük Android 5.1 (API 22).
Veriler telefonun içinde (uygulamanın yerel depolamasında) tutulur; internet, hesap veya sunucu gerekmez.

## APK'yı almanın yolları

### 1) GitHub ile (bilgisayara bir şey kurmadan — en kolayı)
1. github.com'da ücretsiz hesap aç, **New repository** ile (Private olabilir) boş bir depo oluştur.
2. Bu klasörün içeriğini depoya yükle (web arayüzünde **Add file → Upload files**; `node_modules` ve `dist` klasörleri yok, sorun değil).
3. Depoda **Actions** sekmesine gir → **Android APK** → **Run workflow**. (İlk yükleme sonrası kendiliğinden de başlar.) ~5-8 dk sürer.
4. Bitince çalışmanın sayfasının altındaki **Artifacts → cheque-it-out-apk** dosyasını indir, zip'ten `app-debug.apk` çıkar.
5. APK'yı telefona gönder, aç. Android "bilinmeyen kaynaklardan yükleme" izni isteyecek; izin ver ve kur.

### 2) Android Studio ile
Gerekenler: Node.js 20+, Android Studio (JDK 17 ile gelir).
```bash
npm install
npm run build
npx cap sync android
npx cap open android      # Android Studio açılır
```
Android Studio'da **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Telefonu USB ile bağlayıp ▶ ile doğrudan da çalıştırabilirsin.

### 3) Komut satırından (Android SDK + JDK 17 kuruluysa)
```bash
npm install && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# çıktı: android/app/build/outputs/apk/debug/app-debug.apk
```

## Mevcut verilerini taşıma (claude.ai → telefon)
claude.ai'daki sürüm kendi depolamasını kullanır, telefondaki uygulama ayrı bir depolama kullanır; veriler otomatik taşınmaz.
1. claude.ai'daki uygulamada (güncel `src/App.jsx` ile) sağ üstte **⋯ → Yedek al (JSON)** ile yedek dosyasını indir.
2. Dosyayı telefona gönder (Drive, e-posta, WhatsApp vb.).
3. Telefondaki uygulamada **⋯ → Yedekten yükle** ile dosyayı seç. Mevcut veriler yedektekilerle değiştirilir.

Telefonda **⋯ → Yedek al (JSON)** ve **CSV dışa aktar** bir paylaşım menüsü açar (Drive'a kaydet, mesajla gönder vb.). Düzenli yedek almanı öneririm: uygulama verisi silinirse (uygulama verilerini temizleme, kaldırma) veriler de gider.

## Notlar
- Üretilen APK **debug** imzalıdır; kendi telefonunda kullanmak için yeterlidir. Play Store'a yüklemek için release imzası ve AAB gerekir.
- Uygulama kodu tek dosyadır: `src/App.jsx`. `src/main.jsx` sadece depolamayı ve dosya paylaşımını telefona bağlar.
- Uygulama adı/kimliği: `capacitor.config.json` (`appId`: `com.chequeitout.app`). Kimliği değiştirirsen `npx cap sync android` öncesinde Android klasöründeki paket adını da güncellemen gerekir.
- Kod değişirse: `npm run build && npx cap sync android` ve yeniden APK üret.
