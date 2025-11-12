import { configure } from 'quasar/wrappers';

export default configure((ctx) => {
  return {
    eslint: {
      warnings: true,
      errors: true
    },

    preFetch: true,

    app: {
      head: {
        title: 'YardRover Control',
        meta: [
          {
            name: 'description',
            content: 'Control and monitor your autonomous yard utility machine'
          },
          {
            name: 'format-detection',
            content: 'telephone=no'
          },
          {
            name: 'msapplication-tap-highlight',
            content: 'no'
          },
          {
            name: 'viewport',
            content: 'user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width'
          }
        ],
        link: [
          {
            rel: 'icon',
            type: 'image/png',
            href: 'icons/favicon-128x128.png'
          },
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '16x16',
            href: 'icons/favicon-16x16.png'
          },
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '32x32',
            href: 'icons/favicon-32x32.png'
          },
          {
            rel: 'icon',
            type: 'image/png',
            sizes: '96x96',
            href: 'icons/favicon-96x96.png'
          }
        ]
      }
    },

    css: [
      'app.scss'
    ],

    extras: [
      'roboto-font',
      'material-icons'
    ],

    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node20'
      },

      vueRouterMode: 'history',

      env: {
        API_URL: ctx.dev
          ? 'http://192.168.4.1'
          : process.env.API_URL || 'http://yardrover.local',
        WS_URL: ctx.dev
          ? 'ws://192.168.4.1/ws'
          : process.env.WS_URL || 'ws://yardrover.local/ws'
      },

      extendViteConf (viteConf) {
        viteConf.resolve = viteConf.resolve || {};
        viteConf.resolve.alias = {
          ...viteConf.resolve.alias,
          '@': '/src'
        };

        if (ctx.dev) {
          viteConf.build = viteConf.build || {};
          viteConf.build.sourcemap = true;
        }
      }
    },

    devServer: {
      open: true,
      port: 9000
    },

    framework: {
      config: {
        brand: {
          primary: '#2C5F2D',
          secondary: '#87CEEB',
          accent: '#FF6B35',
          positive: '#21BA45',
          negative: '#C10015',
          info: '#31CCEC',
          warning: '#F2C037',
          dark: '#3E2723',
          'dark-page': '#2C2C2C'
        },
        notify: {
          position: 'top-right',
          timeout: 3000,
          textColor: 'white',
          actions: [{ icon: 'close', color: 'white' }]
        },
        loading: {
          delay: 400,
          message: 'Loading...',
          spinnerSize: 60,
          spinnerColor: 'primary'
        }
      },

      iconSet: 'material-icons',

      plugins: [
        'Notify',
        'Loading',
        'Dialog',
        'LoadingBar',
        'LocalStorage',
        'SessionStorage'
      ],

      directives: [
        'Ripple',
        'ClosePopup',
        'TouchSwipe'
      ]
    },

    animations: [],

    ssr: {
      pwa: false,

      prodPort: 3000,

      middlewares: [
        'render'
      ]
    },

    pwa: {
      workboxMode: 'generateSW',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false
    },

    capacitor: {
      hideSplashscreen: true
    },

    electron: {
      inspectPort: 5858,

      bundler: 'packager',

      packager: {},

      builder: {
        appId: 'yardrover.control'
      }
    },

    bex: {
      contentScripts: [
        'my-content-script'
      ]
    }
  };
});