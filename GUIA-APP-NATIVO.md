# 📱 App instalável e app nativo

O abasteci é um **PWA**: já dá para instalar direto do navegador, com ícone
próprio e tela cheia. Este guia cobre a instalação (usuário final) e como gerar
um **app nativo de loja** (Google Play / App Store), se você quiser.

## 1. Instalar como PWA (sem loja)

Dentro do app já existe:
- um **banner "Instalar o abasteci"** (aparece quando o navegador permite);
- o item **Mais → Instalar aplicativo**;
- e um indicador **offline** na barra superior.

Manualmente também dá:
- **Android (Chrome/Edge):** menu **⋮** → **Instalar aplicativo**.
- **iPhone (Safari):** **Compartilhar** → **Adicionar à Tela de Início**.

> Requer o app publicado em **HTTPS** (ex.: Vercel) ou rodando em `localhost`.

## 2. App nativo na Google Play (Android) — caminho mais fácil

Empacota o PWA como app Android (**TWA**) usando o **Bubblewrap**. Reaproveita o
site publicado; nada de reescrever o app.

Pré-requisitos: app publicado (URL HTTPS) e **JDK + Android SDK** (o Bubblewrap
se oferece para instalar).

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://SEU-APP/manifest.webmanifest
bubblewrap build
```

Isso gera um **APK** (para testar) e um **AAB** (para publicar). Ao final, o
Bubblewrap mostra a **impressão digital SHA-256** da sua chave de assinatura —
crie o arquivo abaixo e publique junto do site, para o Android confiar no app:

`public/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.abasteci.app",
    "sha256_cert_fingerprints": ["SUA_IMPRESSAO_SHA256_AQUI"]
  }
}]
```

Depois, envie o `.aab` no [Google Play Console](https://play.google.com/console)
(conta de desenvolvedor, taxa única de US$ 25).

## 3. App nativo iOS + Android com Capacitor — mais controle

O [Capacitor](https://capacitorjs.com) embrulha o app web em um projeto nativo
(permite recursos nativos, notificações push etc.).

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init abasteci com.abasteci.app --web-dir dist
npm run build
npx cap add android      # e/ou:  npx cap add ios
npx cap sync
npx cap open android     # abre no Android Studio  (ios abre no Xcode)
```

- **Android:** gere o APK/AAB pelo Android Studio e publique na Play Store.
- **iOS:** abra no **Xcode** (precisa de um Mac) e publique na App Store
  (conta Apple Developer, US$ 99/ano).

> Dica: como o app já é um bom PWA, comece pela **opção 2 (TWA)** — é o menor
> esforço para ter um app na Google Play. Deixe o Capacitor para quando precisar
> de recursos nativos específicos ou publicar na App Store.
