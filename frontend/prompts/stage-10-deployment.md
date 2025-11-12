# Stage 10: Deployment and CI/CD

## Objective

Set up automated deployment pipelines for web, mobile, and desktop platforms with continuous integration and delivery workflows.

## Tasks

1. Configure GitHub Actions for CI/CD
2. Set up automated testing in CI pipeline
3. Configure build workflows for all platforms
4. Set up code signing for mobile apps
5. Configure automatic version bumping
6. Set up deployment to cloud services
7. Configure app store submissions
8. Set up monitoring and error tracking
9. Configure rollback procedures
10. Create deployment documentation

## CI/CD Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/main.yml
name: YardRover CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: 18

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint code
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build web app
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
          VITE_WS_URL: ${{ secrets.WS_URL }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: web-dist
          path: dist/

  build-mobile:
    needs: test
    strategy:
      matrix:
        platform: [ios, android]
    runs-on: ${{ matrix.platform == 'ios' && 'macos-latest' || 'ubuntu-latest' }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build web assets
        run: npm run build
      
      - name: Setup Java (Android)
        if: matrix.platform == 'android'
        uses: actions/setup-java@v3
        with:
          java-version: '11'
          distribution: 'temurin'
      
      - name: Build Android
        if: matrix.platform == 'android'
        run: |
          npm run build:android
          cd android
          ./gradlew assembleRelease
        env:
          ANDROID_KEYSTORE: ${{ secrets.ANDROID_KEYSTORE }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
      
      - name: Setup Xcode (iOS)
        if: matrix.platform == 'ios'
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      
      - name: Build iOS
        if: matrix.platform == 'ios'
        run: |
          npm run build:ios
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Release
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}

  build-desktop:
    needs: test
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Electron app
        run: npm run dist:${{ matrix.os == 'windows-latest' && 'win' || matrix.os == 'macos-latest' && 'mac' || 'linux' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_LINK: ${{ secrets.MAC_CERTS }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: desktop-${{ matrix.os }}
          path: dist_electron/

  deploy-web:
    needs: build-web
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: web-dist
          path: dist/
      
      - name: Deploy to Netlify
        uses: netlify/actions/deploy@v1
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-token: ${{ secrets.NETLIFY_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
      
      - name: Deploy to AWS S3
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_ID }} --paths "/*"
```

### Mobile App Distribution

```yaml
# .github/workflows/mobile-release.yml
name: Mobile Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Android release
        run: |
          npm run build
          cd android
          ./gradlew bundleRelease
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
      
      - name: Upload to Google Play
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName: com.yardrover.app
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: production
          whatsNewDirectory: release-notes/

  release-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build iOS release
        run: |
          npm run build
          cd ios/App
          xcodebuild archive \
            -workspace App.xcworkspace \
            -scheme App \
            -archivePath YardRover.xcarchive
          
          xcodebuild -exportArchive \
            -archivePath YardRover.xcarchive \
            -exportPath export \
            -exportOptionsPlist ExportOptions.plist
      
      - name: Upload to TestFlight
        uses: apple-actions/upload-testflight-build@v1
        with:
          app-path: ios/App/export/YardRover.ipa
          issuer-id: ${{ secrets.APP_STORE_CONNECT_ISSUER_ID }}
          api-key-id: ${{ secrets.APP_STORE_CONNECT_API_KEY_ID }}
          api-private-key: ${{ secrets.APP_STORE_CONNECT_API_KEY }}
```

### Monitoring and Error Tracking

```typescript
// src/utils/monitoring.ts
import * as Sentry from '@sentry/vue'
import { BrowserTracing } from '@sentry/tracing'
import { App } from 'vue'
import { Router } from 'vue-router'

export function setupMonitoring(app: App, router: Router) {
  // Sentry error tracking
  if (import.meta.env.PROD) {
    Sentry.init({
      app,
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        new BrowserTracing({
          routingInstrumentation: Sentry.vueRouterInstrumentation(router),
          tracingOrigins: ['api.yardrover.com', /^\//]
        })
      ],
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
      
      beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request) {
          delete event.request.cookies
          delete event.request.headers?.authorization
        }
        return event
      }
    })
  }
  
  // Google Analytics
  if (window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA_ID, {
      page_path: router.currentRoute.value.path
    })
    
    router.afterEach((to) => {
      window.gtag('event', 'page_view', {
        page_path: to.path,
        page_title: to.name
      })
    })
  }
  
  // Performance monitoring
  if ('performance' in window && 'PerformanceObserver' in window) {
    const perfObserver = new PerformanceObserver((entries) => {
      entries.getEntries().forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          window.gtag?.('event', 'LCP', {
            value: Math.round(entry.startTime),
            page: router.currentRoute.value.path
          })
        }
      })
    })
    
    perfObserver.observe({ entryTypes: ['largest-contentful-paint'] })
  }
}
```

### Deployment Configuration

```javascript
// deploy.config.js
module.exports = {
  production: {
    web: {
      provider: 'aws',
      region: 'us-east-1',
      bucket: 'yardrover-app',
      cloudfront: {
        distributionId: 'E1234567890ABC'
      }
    },
    
    api: {
      url: 'https://api.yardrover.com',
      wsUrl: 'wss://ws.yardrover.com'
    },
    
    monitoring: {
      sentry: {
        dsn: process.env.SENTRY_DSN
      },
      
      analytics: {
        ga: process.env.GA_ID
      }
    }
  },
  
  staging: {
    web: {
      provider: 'netlify',
      siteId: process.env.NETLIFY_SITE_ID
    },
    
    api: {
      url: 'https://staging-api.yardrover.com',
      wsUrl: 'wss://staging-ws.yardrover.com'
    }
  }
}
```

## Expected Output

A fully automated CI/CD pipeline that builds, tests, and deploys the YardRover application across all platforms with proper monitoring and error tracking in place.
