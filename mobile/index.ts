import { registerRootComponent } from 'expo';

import App from './App';
import { registerLiveAlertBackgroundHandler } from './lib/liveAlertRinger';

// Has to run at module load, before any component mounts, so the OS can wake a headless JS
// context for a go-live push while the app is in the background.
registerLiveAlertBackgroundHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
