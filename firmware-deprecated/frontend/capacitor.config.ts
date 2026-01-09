import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.yardrover.app',
    appName: 'YardRover',
    webDir: 'dist',

    server: {
        androidScheme: 'https'
    },

    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#4CAF50',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            androidSpinnerStyle: 'large',
            iosSpinnerStyle: 'small',
            spinnerColor: '#ffffff',
            splashFullScreen: true,
            splashImmersive: true
        }
    }
}

export default config
